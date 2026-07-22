-- ═══════════════════════════════════════════════════════════════════
-- Design Partner — one-time Supabase setup  (PRE-FILLED, no edits needed)
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- Creates: the responses table + RLS, and the Chayne login
--          chayne@quantumqustody.com / Quorum-fVrNa3-nRgANG
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Responses table ──────────────────────────────────────────────
create table if not exists public.design_partner_responses (
  id               uuid primary key default gen_random_uuid(),
  partner          text not null,
  respondent_email text,
  answers          jsonb not null default '{}'::jsonb,
  sections         jsonb,
  answered_count   integer,
  total_questions  integer,
  created_at       timestamptz not null default now()
);

create index if not exists design_partner_responses_partner_idx
  on public.design_partner_responses (partner, created_at desc);

-- The edge function writes with the service role (bypasses RLS). The
-- authenticated-insert policy is only a fallback so a submission is never
-- lost if the function is unavailable. No client read access.
alter table public.design_partner_responses enable row level security;

drop policy if exists "design partner insert" on public.design_partner_responses;
create policy "design partner insert"
  on public.design_partner_responses
  for insert to authenticated
  with check (true);


-- ── 2. Create (or repair) the design-partner login ──────────────────
-- Idempotent: safe to re-run. Re-running resets the password to the one
-- below, re-confirms the email, and (re)grants the design_partner role.
create extension if not exists pgcrypto;

do $$
declare
  v_email text := 'chayne@quantumqustody.com';
  v_pass  text := 'Quorum-fVrNa3-nRgANG';
  v_uid   uuid;
  v_has_provider_id boolean;
begin
  select id into v_uid from auth.users where email = v_email;

  if v_uid is null then
    v_uid := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
      v_email, crypt(v_pass, gen_salt('bf')), now(),
      -- role lives in APP metadata (service-role only). Putting it in user
      -- metadata would let anyone self-grant access via public sign-up.
      '{"provider":"email","providers":["email"],"role":"design_partner"}'::jsonb,
      '{}'::jsonb, now(), now(), '', '', '', ''
    );

    -- auth.identities gained provider_id in newer GoTrue — insert either shape.
    select exists (
      select 1 from information_schema.columns
      where table_schema='auth' and table_name='identities' and column_name='provider_id'
    ) into v_has_provider_id;

    if v_has_provider_id then
      insert into auth.identities (id, user_id, provider_id, identity_data, provider,
                                   last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), v_uid, v_uid::text,
              jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
              'email', now(), now(), now());
    else
      insert into auth.identities (id, user_id, identity_data, provider,
                                   last_sign_in_at, created_at, updated_at)
      values (v_uid, v_uid,
              jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
              'email', now(), now(), now());
    end if;

    raise notice 'Created design partner user %', v_email;
  else
    update auth.users set
      encrypted_password = crypt(v_pass, gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      raw_app_meta_data  = coalesce(raw_app_meta_data, '{}'::jsonb)
                             || '{"role":"design_partner"}'::jsonb,
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'role',
      updated_at = now()
    where id = v_uid;
    raise notice 'Updated existing user %', v_email;
  end if;
end $$;


-- ── 3. Verify — expect one row: role=design_partner, confirmed=true ──
select email,
       raw_app_meta_data ->> 'role'           as role,
       (email_confirmed_at is not null)        as confirmed
from auth.users
where email = 'chayne@quantumqustody.com';


-- ═══════════════════════════════════════════════════════════════════
-- Housekeeping
-- ═══════════════════════════════════════════════════════════════════
-- Revoke access:
--   update auth.users set raw_app_meta_data = raw_app_meta_data - 'role'
--   where email = 'chayne@quantumqustody.com';
--
-- Read submissions:
--   select created_at, respondent_email, answered_count, total_questions, answers
--   from public.design_partner_responses order by created_at desc;
