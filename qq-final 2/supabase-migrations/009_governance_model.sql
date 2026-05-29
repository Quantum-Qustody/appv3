-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║   Migration 009 — Governance data model (Phase 4, REVIEW BRANCH)  ║
-- ║   Simplified roles, user states, draft→active policy, M-of-N      ║
-- ║   thresholds, policy-change governance log                        ║
-- ║                                                                   ║
-- ║   THIS MIGRATION SHIPS ON feat/sandbox-feedback-4-5-review ONLY   ║
-- ║   Do NOT run on production until reviewed.                        ║
-- ╚═══════════════════════════════════════════════════════════════════╝

-- 1. SIMPLIFIED ROLE — spec §6 ──────────────────────────────────────
-- Production set: Admin, Requester, Approver, Observer.
-- Old roles (Reviewer, Oversight) remain valid for backwards-compat
-- via the existing participant_role enum; we add an additional
-- 'governance_role' column that uses the new minimal set.

do $$ begin
  create type governance_role as enum ('Admin','Requester','Approver','Observer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_state as enum ('Pending','Active','Disabled','Expired','Revoked');
exception when duplicate_object then null; end $$;

alter table participants
  add column if not exists governance_role governance_role,
  add column if not exists user_state user_state default 'Pending',
  add column if not exists invited_by uuid,
  add column if not exists last_activity_at timestamptz default now();

-- Backfill governance_role from existing scenario_role
update participants set
  governance_role = case
    when scenario_role::text in ('Reviewer','Oversight') then 'Observer'::governance_role
    when scenario_role::text in ('Requester','Approver','Observer') then scenario_role::text::governance_role
    else 'Requester'::governance_role
  end
 where governance_role is null;

update participants set
  user_state = case
    when status::text = 'active' then 'Active'::user_state
    when status::text = 'disabled' then 'Disabled'::user_state
    else 'Pending'::user_state
  end
 where user_state is null;

-- 2. POLICY VERSIONS — spec §9 ──────────────────────────────────────
-- Draft → PendingApproval → Active → Superseded
do $$ begin
  create type policy_status as enum ('Draft','PendingApproval','Active','Superseded','Rejected');
exception when duplicate_object then null; end $$;

create table if not exists policy_versions (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade not null,
  version text not null,
  status policy_status default 'Draft',
  -- M-of-N thresholds — spec §7
  required_approvals int default 2,
  total_approvers int default 3,
  required_oversight int default 0,    -- optional Oversight gate for high-risk
  -- Limits
  amount_ceiling_usd numeric,
  destination_allowlist text[],
  -- Authors
  drafted_by uuid,
  drafted_at timestamptz default now(),
  activated_at timestamptz,
  superseded_at timestamptz,
  notes text
);

create index if not exists policy_versions_org_idx on policy_versions(org_id);
create index if not exists policy_versions_status_idx on policy_versions(status);
alter table policy_versions disable row level security;

-- 3. POLICY-CHANGE APPROVALS — spec §10 ─────────────────────────────
-- Every policy change is itself a governed action. The proposer cannot
-- be the sole approver — guard at insert time.

create table if not exists policy_approvals (
  id uuid primary key default uuid_generate_v4(),
  policy_version_id uuid references policy_versions(id) on delete cascade not null,
  approver_id uuid references participants(id),
  vote text check (vote in ('approve','reject')),
  created_at timestamptz default now(),
  unique(policy_version_id, approver_id)
);

alter table policy_approvals disable row level security;

create or replace function public.policy_proposer_cannot_solo_approve()
returns trigger language plpgsql as $$
declare
  v_drafter uuid;
  v_distinct_approvers int;
begin
  select drafted_by into v_drafter
    from policy_versions where id = new.policy_version_id;
  if v_drafter is not null and new.approver_id = v_drafter then
    -- proposer can vote, but cannot be the only approve
    select count(distinct approver_id) into v_distinct_approvers
      from policy_approvals
     where policy_version_id = new.policy_version_id
       and approver_id <> v_drafter and vote = 'approve';
    if v_distinct_approvers = 0 and new.vote = 'approve' then
      raise exception 'proposer cannot be the sole approver of a policy change';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists policy_proposer_check on policy_approvals;
create trigger policy_proposer_check
  before insert on policy_approvals
  for each row execute function public.policy_proposer_cannot_solo_approve();

-- 4. SEED THE FIRST DRAFT POLICY for any org that doesn't have one ──
insert into policy_versions (org_id, version, status, required_approvals, total_approvers, drafted_at)
select id, 'v1.0-draft', 'Draft', 2, 3, now() from organizations
where not exists (select 1 from policy_versions pv where pv.org_id = organizations.id);
