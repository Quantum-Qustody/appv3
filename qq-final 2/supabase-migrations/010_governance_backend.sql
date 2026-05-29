-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║   Migration 010 — Full governance backend (Phases 4 + 5)          ║
-- ║                                                                   ║
-- ║   Implements PDF spec sections 3, 5, 9, 10, 11:                   ║
-- ║   - Smart account state on organizations (Pending/Deployed/       ║
-- ║     Governed Active)                                              ║
-- ║   - Funding rule enforcement (no funding before activation)       ║
-- ║   - Policy activation flow (Draft → PendingApproval → Active)     ║
-- ║   - Policy-change governance (each change a governed action)      ║
-- ║   - Transaction validation against active policy                  ║
-- ║   - Pending invitee guard (ghost-approver protection)             ║
-- ║   - Dormant invite expiry                                         ║
-- ║   - User state transitions with role-aware approval-authority     ║
-- ║                                                                   ║
-- ║   Idempotent. Safe to re-run.                                     ║
-- ╚═══════════════════════════════════════════════════════════════════╝

-- ─── 1. Smart account state on organizations (spec §3, §4) ─────────
do $$ begin
  create type smart_account_status as enum ('NotDeployed','Pending','Deployed','GovernedActive');
exception when duplicate_object then null; end $$;

alter table organizations
  add column if not exists smart_account_address text,
  add column if not exists smart_account_status  smart_account_status default 'NotDeployed',
  add column if not exists root_eoa_address      text,
  add column if not exists governed_active_at    timestamptz;

-- Deterministic mock smart-account address derived from the root EOA
-- (real ERC-4337 counterfactual deployment lives in a future migration).
create or replace function public.derive_mock_smart_account(p_eoa text)
returns text language sql immutable as $$
  select case when p_eoa is null or length(p_eoa) < 10 then null
              else '0xQ2' || lower(substr(p_eoa, 3, 36)) || 'sa' end;
$$;

-- Setting the root EOA also computes the smart account address and
-- transitions to "Pending" if it wasn't already past that state.
create or replace function public.set_root_eoa(p_org uuid, p_eoa text)
returns json language plpgsql security definer set search_path = public as $$
declare v_sa text; v_org organizations%rowtype;
begin
  if p_org is null or p_eoa is null then return json_build_object('error','missing args'); end if;
  v_sa := public.derive_mock_smart_account(p_eoa);
  select * into v_org from organizations where id = p_org;
  if v_org.smart_account_status = 'GovernedActive' then
    return json_build_object('error','smart account already governed-active; recovery flow required');
  end if;
  update organizations set
    root_eoa_address = p_eoa,
    smart_account_address = v_sa,
    smart_account_status = case when smart_account_status = 'NotDeployed' then 'Pending'::smart_account_status else smart_account_status end
   where id = p_org;
  return json_build_object('ok',true,'smart_account_address',v_sa);
end; $$;
grant execute on function public.set_root_eoa(uuid, text) to anon, authenticated;

-- ─── 2. Policy lifecycle helpers (spec §9) ─────────────────────────
-- The setup wizard now creates a draft policy. Activation runs through
-- a proposal/approval flow rather than a direct flip.

-- Submit a draft policy for activation. Moves status Draft → PendingApproval.
create or replace function public.submit_policy_for_activation(p_policy uuid)
returns json language plpgsql security definer set search_path = public as $$
declare v_p policy_versions%rowtype;
begin
  select * into v_p from policy_versions where id = p_policy;
  if not found then return json_build_object('error','policy not found'); end if;
  if v_p.status <> 'Draft' then return json_build_object('error','policy not in Draft (current: ' || v_p.status::text || ')'); end if;
  update policy_versions set status = 'PendingApproval' where id = p_policy;
  return json_build_object('ok',true);
end; $$;
grant execute on function public.submit_policy_for_activation(uuid) to anon, authenticated;

-- An approver votes on a pending policy. When the required threshold of
-- distinct Approver-role + Active-state members has voted approve, the
-- policy auto-activates and the org transitions to GovernedActive.
create or replace function public.vote_on_policy(p_policy uuid, p_approver uuid, p_vote text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_p   policy_versions%rowtype;
  v_ap  participants%rowtype;
  v_yes int;
  v_no  int;
begin
  if p_vote not in ('approve','reject') then return json_build_object('error','vote must be approve or reject'); end if;
  select * into v_p from policy_versions where id = p_policy;
  if not found then return json_build_object('error','policy not found'); end if;
  if v_p.status <> 'PendingApproval' then return json_build_object('error','policy not in PendingApproval'); end if;

  select * into v_ap from participants where id = p_approver;
  if not found then return json_build_object('error','approver not found'); end if;
  if (v_ap.governance_role is null or v_ap.governance_role::text <> 'Approver') then
    return json_build_object('error','only Approver role can vote');
  end if;
  if (v_ap.user_state is null or v_ap.user_state::text <> 'Active') then
    return json_build_object('error','approver not in Active state (ghost-approver guard)');
  end if;

  -- Record/replace vote (idempotent)
  insert into policy_approvals(policy_version_id, approver_id, vote)
  values (p_policy, p_approver, p_vote)
  on conflict (policy_version_id, approver_id) do update set vote = excluded.vote, created_at = now();

  -- Tally
  select count(*) into v_yes from policy_approvals where policy_version_id = p_policy and vote = 'approve';
  select count(*) into v_no  from policy_approvals where policy_version_id = p_policy and vote = 'reject';

  if v_yes >= coalesce(v_p.required_approvals,2) then
    update policy_versions set status = 'Active', activated_at = now() where id = p_policy;
    -- Transition org smart-account to GovernedActive
    update organizations set
      smart_account_status = 'GovernedActive',
      governed_active_at = now()
     where id = v_p.org_id
       and smart_account_status in ('Pending','Deployed');
  elsif v_no > coalesce(v_p.total_approvers,3) - coalesce(v_p.required_approvals,2) then
    update policy_versions set status = 'Rejected' where id = p_policy;
  end if;

  return json_build_object('ok',true,'approve_count',v_yes,'reject_count',v_no);
end; $$;
grant execute on function public.vote_on_policy(uuid, uuid, text) to anon, authenticated;

-- ─── 3. Policy-change proposals (spec §10) ─────────────────────────
-- Every change after activation goes through a proposal: add/remove
-- approver, reduce threshold, increase limits, add destination,
-- install/upgrade modules. The proposer cannot be the sole approver.

do $$ begin
  create type policy_change_type as enum (
    'AddApprover','RemoveApprover','ReduceThreshold','RaiseThreshold',
    'IncreaseLimit','AddDestination','InstallModule','UpgradeLogic',
    'ChangeRecovery','DisablePolicy'
  );
exception when duplicate_object then null; end $$;

create table if not exists policy_change_proposals (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade not null,
  proposer_id uuid references participants(id),
  change_type policy_change_type not null,
  payload jsonb,                          -- structured change details
  status text default 'Pending',          -- Pending | Approved | Rejected | Expired
  required_approvals int default 2,
  timelock_until timestamptz,             -- spec §10 — reduce threshold requires timelock
  created_at timestamptz default now(),
  approved_at timestamptz,
  applied_at timestamptz
);
alter table policy_change_proposals disable row level security;

create table if not exists policy_change_approvals (
  id uuid primary key default uuid_generate_v4(),
  proposal_id uuid references policy_change_proposals(id) on delete cascade not null,
  approver_id uuid references participants(id),
  vote text check (vote in ('approve','reject')),
  created_at timestamptz default now(),
  unique(proposal_id, approver_id)
);
alter table policy_change_approvals disable row level security;

-- Propose a policy change. Returns the proposal id and required approvals.
create or replace function public.propose_policy_change(
  p_org uuid, p_proposer uuid, p_change_type policy_change_type, p_payload jsonb
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_active policy_versions%rowtype;
  v_active_approvers int;
  v_required int;
  v_timelock timestamptz;
  v_proposal_id uuid;
begin
  select * into v_active from policy_versions where org_id = p_org and status = 'Active' order by activated_at desc limit 1;
  if not found then return json_build_object('error','no active policy — initial activation flow required'); end if;

  select count(*) into v_active_approvers
    from participants
   where org_id = p_org
     and governance_role::text = 'Approver'
     and user_state::text = 'Active';

  -- Spec §10 — required approvals depend on change type
  v_required := case p_change_type
    when 'ReduceThreshold' then greatest(v_active.required_approvals, 3)        -- higher-order approval
    when 'UpgradeLogic'    then greatest(v_active.required_approvals + 1, 3)
    when 'DisablePolicy'   then v_active_approvers                              -- effectively unanimity
    else v_active.required_approvals
  end;

  -- Timelock — 24h for threshold reduction or logic upgrade
  v_timelock := case p_change_type
    when 'ReduceThreshold' then now() + interval '24 hours'
    when 'UpgradeLogic'    then now() + interval '24 hours'
    when 'ChangeRecovery'  then now() + interval '24 hours'
    else now()
  end;

  insert into policy_change_proposals(org_id, proposer_id, change_type, payload, required_approvals, timelock_until)
  values (p_org, p_proposer, p_change_type, p_payload, v_required, v_timelock)
  returning id into v_proposal_id;

  return json_build_object('ok',true,'proposal_id',v_proposal_id,'required',v_required,'timelock_until',v_timelock);
end; $$;
grant execute on function public.propose_policy_change(uuid, uuid, policy_change_type, jsonb) to anon, authenticated;

-- Vote on a policy-change proposal. Enforces proposer-cannot-be-sole-approver
-- and the role-based active-approver guard.
create or replace function public.vote_on_policy_change(
  p_proposal uuid, p_approver uuid, p_vote text
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_p   policy_change_proposals%rowtype;
  v_ap  participants%rowtype;
  v_other_yes int; v_yes int; v_no int;
begin
  if p_vote not in ('approve','reject') then return json_build_object('error','bad vote'); end if;
  select * into v_p from policy_change_proposals where id = p_proposal;
  if not found then return json_build_object('error','proposal not found'); end if;
  if v_p.status <> 'Pending' then return json_build_object('error','proposal is ' || v_p.status); end if;

  select * into v_ap from participants where id = p_approver;
  if v_ap.governance_role::text <> 'Approver' or v_ap.user_state::text <> 'Active' then
    return json_build_object('error','not an active Approver');
  end if;

  -- Proposer-cannot-solo-approve (spec §10)
  if v_ap.id = v_p.proposer_id and p_vote = 'approve' then
    select count(*) into v_other_yes from policy_change_approvals
      where proposal_id = p_proposal and approver_id <> v_p.proposer_id and vote = 'approve';
    if v_other_yes = 0 then
      return json_build_object('error','proposer cannot be the sole approver');
    end if;
  end if;

  insert into policy_change_approvals(proposal_id, approver_id, vote)
  values (p_proposal, p_approver, p_vote)
  on conflict (proposal_id, approver_id) do update set vote = excluded.vote, created_at = now();

  select count(*) into v_yes from policy_change_approvals where proposal_id = p_proposal and vote='approve';
  select count(*) into v_no  from policy_change_approvals where proposal_id = p_proposal and vote='reject';

  if v_yes >= v_p.required_approvals and now() >= v_p.timelock_until then
    update policy_change_proposals set status='Approved', approved_at=now() where id = p_proposal;
    -- Apply the change (a real implementation would dispatch by change_type;
    -- for the MVP we just mark applied — the front-end then reflects it).
    update policy_change_proposals set applied_at=now() where id = p_proposal;
  end if;

  return json_build_object('ok',true,'approve_count',v_yes,'reject_count',v_no,'timelock_remaining_s',
    greatest(0, extract(epoch from (v_p.timelock_until - now())))::int);
end; $$;
grant execute on function public.vote_on_policy_change(uuid, uuid, text) to anon, authenticated;

-- ─── 4. Transaction validation (spec §11) ──────────────────────────
-- Called by the front-end before broadcasting a transaction. Checks:
-- active policy, amount limit, destination allowlist, smart-account
-- governed-active, funding rule.
create or replace function public.validate_movement(
  p_org uuid, p_amount numeric, p_destination text, p_token text, p_action text
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_o  organizations%rowtype;
  v_p  policy_versions%rowtype;
  v_allowed boolean := true;
  v_reasons text[] := '{}';
begin
  select * into v_o from organizations where id = p_org;
  if not found then return json_build_object('valid',false,'reasons',array['org not found']); end if;

  -- Spec §5 — funding/movement requires GovernedActive
  if v_o.smart_account_status::text <> 'GovernedActive' then
    v_allowed := false;
    v_reasons := array_append(v_reasons,
      'Smart account is not Governed-Active. Activate the initial policy via the Team page first.');
  end if;

  select * into v_p from policy_versions
   where org_id = p_org and status = 'Active'
   order by activated_at desc limit 1;
  if not found then
    v_allowed := false;
    v_reasons := array_append(v_reasons,'No active policy version. Configure and activate a draft policy.');
  else
    -- Amount limit
    if v_p.amount_ceiling_usd is not null and p_amount > v_p.amount_ceiling_usd then
      v_allowed := false;
      v_reasons := array_append(v_reasons,
        format('Amount %s exceeds the active policy ceiling (%s).', p_amount, v_p.amount_ceiling_usd));
    end if;
    -- Destination allowlist
    if v_p.destination_allowlist is not null and array_length(v_p.destination_allowlist, 1) > 0
       and not (lower(p_destination) = any(select lower(unnest(v_p.destination_allowlist)))) then
      v_allowed := false;
      v_reasons := array_append(v_reasons,
        format('Destination %s is not on the policy allowlist.', p_destination));
    end if;
  end if;

  return json_build_object(
    'valid', v_allowed,
    'reasons', v_reasons,
    'policy_id', v_p.id,
    'policy_version', v_p.version,
    'sa_status', v_o.smart_account_status
  );
end; $$;
grant execute on function public.validate_movement(uuid, numeric, text, text, text) to anon, authenticated;

-- ─── 5. User state transitions (spec §8) ───────────────────────────
-- Only Active Approver-role members count toward thresholds. Provide
-- a controlled transition function.
create or replace function public.set_user_state(p_participant uuid, p_new user_state)
returns json language plpgsql security definer set search_path = public as $$
declare v_p participants%rowtype;
begin
  select * into v_p from participants where id = p_participant;
  if not found then return json_build_object('error','participant not found'); end if;
  -- Revoked is terminal
  if v_p.user_state = 'Revoked' and p_new <> 'Revoked' then
    return json_build_object('error','revoked is terminal — re-invite required');
  end if;
  update participants set user_state = p_new, last_activity_at = now() where id = p_participant;
  return json_build_object('ok',true,'from',v_p.user_state,'to',p_new);
end; $$;
grant execute on function public.set_user_state(uuid, user_state) to anon, authenticated;

-- ─── 6. Auto-expire dormant invitations (spec §9 controls) ─────────
-- Runs cheaply on every team_invitations select (idempotent).
create or replace function public.expire_stale_invitations()
returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  with upd as (
    update team_invitations set status = 'expired'
     where status = 'pending' and expires_at < now()
     returning 1
  ) select count(*) into v_n from upd;
  return v_n;
end; $$;
grant execute on function public.expire_stale_invitations() to anon, authenticated;

-- ─── 7. Bootstrap draft policy for an org (called at setup time) ──
create or replace function public.bootstrap_draft_policy(p_org uuid, p_required int default 2, p_total int default 3)
returns json language plpgsql security definer set search_path = public as $$
declare v_existing policy_versions%rowtype; v_id uuid;
begin
  select * into v_existing from policy_versions where org_id = p_org order by drafted_at desc limit 1;
  if found then return json_build_object('ok',true,'policy_id',v_existing.id,'reused',true); end if;
  insert into policy_versions(org_id, version, status, required_approvals, total_approvers)
  values (p_org, 'v1.0-draft', 'Draft', greatest(p_required,1), greatest(p_total,p_required))
  returning id into v_id;
  return json_build_object('ok',true,'policy_id',v_id,'reused',false);
end; $$;
grant execute on function public.bootstrap_draft_policy(uuid, int, int) to anon, authenticated;
