-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║   Migration 003 — Team email invitations                          ║
-- ║   Tables, indexes, auto-link trigger                              ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- Run AFTER 002. Idempotent — safe to re-run.

-- ─── Invitations table ────────────────────────────────────────────
create table if not exists team_invitations (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade not null,
  email text not null,
  scenario_role text default 'Requester',         -- Requester / Approver / Reviewer / Oversight / Observer
  institution_fn text,
  threshold_weight int default 1,
  invited_by uuid,                                 -- auth.users.id of the inviter
  status text default 'pending',                   -- pending | accepted | revoked | expired
  token text not null unique,                      -- random token used for tracking
  expires_at timestamptz default (now() + interval '14 days'),
  created_at timestamptz default now(),
  accepted_at timestamptz
);

create index if not exists team_invitations_org_idx on team_invitations(org_id);
create index if not exists team_invitations_email_idx on team_invitations(email);
create index if not exists team_invitations_token_idx on team_invitations(token);

alter table team_invitations disable row level security;

-- ─── Helper: link an existing or just-signed-up user to an invite ──
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
  select * into v_invite from team_invitations where token = p_token;
  if not found then
    return json_build_object('error','invitation not found');
  end if;
  if v_invite.status <> 'pending' then
    return json_build_object('error','invitation already '||v_invite.status);
  end if;
  if v_invite.expires_at < now() then
    update team_invitations set status='expired' where id = v_invite.id;
    return json_build_object('error','invitation expired');
  end if;

  -- Pull user email/name
  select email, coalesce(raw_user_meta_data->>'full_name', split_part(email,'@',1))
    into v_user_email, v_full_name
    from auth.users where id = p_user_id;

  if v_user_email is null then
    return json_build_object('error','user not found');
  end if;

  v_initials := upper(substr(v_full_name,1,1) || coalesce(substr(split_part(v_full_name,' ',2),1,1),''));

  -- Create the participants row tied to the org
  insert into participants(org_id, name, email, institution_fn, scenario_role, status, initials, threshold_weight)
  values (v_invite.org_id, v_full_name, v_user_email, v_invite.institution_fn, v_invite.scenario_role, 'active', v_initials, coalesce(v_invite.threshold_weight,1));

  -- Mark invite accepted
  update team_invitations set status='accepted', accepted_at=now() where id = v_invite.id;

  return json_build_object('ok',true,'org_id',v_invite.org_id);
end;
$$;

grant execute on function public.accept_team_invitation(text, uuid) to anon, authenticated;

-- ─── Trigger: auto-accept on auth.users insert if metadata.invite_token is set
create or replace function public.handle_new_user_invite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  v_token := new.raw_user_meta_data ->> 'invite_token';
  if v_token is not null and v_token <> '' then
    perform public.accept_team_invitation(v_token, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_invite on auth.users;
create trigger on_auth_user_created_invite
  after insert on auth.users
  for each row execute function public.handle_new_user_invite();
