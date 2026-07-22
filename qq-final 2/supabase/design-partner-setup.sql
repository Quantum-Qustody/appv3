-- ═══════════════════════════════════════════════════════════════════
-- Design Partner — one-time Supabase setup
-- Run this whole file in: Supabase Dashboard → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════════════

-- 1. Table that collects completed discovery submissions ──────────────
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

-- 2. RLS: the edge function writes with the service role (which bypasses
--    RLS). We allow authenticated inserts purely as a client-side fallback
--    so a submission is never lost if the function is unavailable.
--    No client read access — responses are read in the dashboard only.
alter table public.design_partner_responses enable row level security;

drop policy if exists "design partner insert" on public.design_partner_responses;
create policy "design partner insert"
  on public.design_partner_responses
  for insert to authenticated
  with check (true);

-- 3. Grant the Design Partner role to the account you created ─────────
--    Create the user first:  Authentication → Users → Add user
--      • Email:    the partner's email
--      • Password: (paste the generated one)
--      • Auto Confirm User:  ON      ← important, or they can't sign in
--    Then replace the email below and run this statement.
--    The gate refuses any account without role = 'design_partner'.

update auth.users
set raw_user_meta_data =
      coalesce(raw_user_meta_data, '{}'::jsonb) || '{"role":"design_partner"}'::jsonb
where email = 'REPLACE_WITH_PARTNER_EMAIL';

-- Verify it took (should return one row with role = design_partner):
select email,
       raw_user_meta_data ->> 'role' as role,
       (email_confirmed_at is not null) as confirmed
from auth.users
where email = 'REPLACE_WITH_PARTNER_EMAIL';

-- ── To revoke access later ──────────────────────────────────────────
-- update auth.users
-- set raw_user_meta_data = raw_user_meta_data - 'role'
-- where email = 'REPLACE_WITH_PARTNER_EMAIL';

-- ── To read submissions ─────────────────────────────────────────────
-- select created_at, partner, respondent_email, answered_count, total_questions
-- from public.design_partner_responses order by created_at desc;
