-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║   Migration 005 — Make invitation triggers exception-safe         ║
-- ║   Fixes: "Database error saving new user" when inviting users     ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- Run AFTER 003. Idempotent — safe to re-run.

-- The previous handle_new_user_invite could throw an exception inside the
-- AFTER INSERT trigger, which Supabase Auth surfaces as "Database error
-- saving new user". This migration:
--   1. Wraps everything in EXCEPTION handlers so user creation NEVER fails
--      because of an invitation issue
--   2. Logs the failure to a new audit table for debugging
--   3. Adds a backup linker so accept_team_invitation can be called from
--      the client after sign-in if the trigger missed it

create table if not exists invitation_link_failures (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid,
  token text,
  reason text,
  created_at timestamptz default now()
);
alter table invitation_link_failures disable row level security;

-- ─── Resilient accept_team_invitation ─────────────────────────────
create or replace function public.accept_team_invitation(p_token text, p_user_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite team_invitations%rowtype;
  v_user_email text;
  v_initials text;
  v_full_name text;
begin
  if p_token is null or p_token = '' then
    return json_build_object('error','no token provided');
  end if;

  select * into v_invite from team_invitations where token = p_token;
  if not found then
    insert into invitation_link_failures(user_id, token, reason) values (p_user_id, p_token, 'invitation_not_found');
    return json_build_object('error','invitation not found');
  end if;
  if v_invite.status <> 'pending' then
    return json_build_object('error','invitation already '||v_invite.status);
  end if;
  if v_invite.expires_at < now() then
    update team_invitations set status='expired' where id = v_invite.id;
    return json_build_object('error','invitation expired');
  end if;

  begin
    select email, coalesce(raw_user_meta_data->>'full_name', split_part(email,'@',1))
      into v_user_email, v_full_name
      from auth.users where id = p_user_id;
  exception when others then
    insert into invitation_link_failures(user_id, token, reason) values (p_user_id, p_token, 'auth_users_lookup_failed: '||SQLERRM);
    return json_build_object('error','user lookup failed');
  end;

  if v_user_email is null then
    insert into invitation_link_failures(user_id, token, reason) values (p_user_id, p_token, 'user_email_null');
    return json_build_object('error','user email missing');
  end if;

  v_initials := upper(substr(coalesce(v_full_name,''),1,1) || coalesce(substr(split_part(coalesce(v_full_name,''),' ',2),1,1),''));
  if v_initials = '' then v_initials := upper(substr(v_user_email,1,2)); end if;

  begin
    insert into participants(org_id, name, email, institution_fn, scenario_role, status, initials, threshold_weight)
    values (v_invite.org_id, coalesce(v_full_name, v_user_email), v_user_email, v_invite.institution_fn, v_invite.scenario_role, 'active', v_initials, coalesce(v_invite.threshold_weight,1));
  exception when others then
    insert into invitation_link_failures(user_id, token, reason) values (p_user_id, p_token, 'participants_insert_failed: '||SQLERRM);
    return json_build_object('error','participants insert failed: '||SQLERRM);
  end;

  update team_invitations set status='accepted', accepted_at=now() where id = v_invite.id;

  return json_build_object('ok',true,'org_id',v_invite.org_id);
end;
$$;

grant execute on function public.accept_team_invitation(text, uuid) to anon, authenticated;

-- ─── Resilient trigger function: never fail the user insert ────────
create or replace function public.handle_new_user_invite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_result json;
begin
  begin
    v_token := new.raw_user_meta_data ->> 'invite_token';
  exception when others then
    v_token := null;
  end;

  if v_token is not null and v_token <> '' then
    begin
      v_result := public.accept_team_invitation(v_token, new.id);
    exception when others then
      -- Swallow ANY error so the auth.users insert never gets rolled back
      insert into invitation_link_failures(user_id, token, reason)
      values (new.id, v_token, 'trigger_caught: '||SQLERRM);
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_invite on auth.users;
create trigger on_auth_user_created_invite
  after insert on auth.users
  for each row execute function public.handle_new_user_invite();
