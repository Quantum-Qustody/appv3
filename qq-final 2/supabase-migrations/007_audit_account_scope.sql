-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║   Migration 007 — Account-scoped audit log + wallet-scoped TX    ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- Feedback item 2 (Phase 1): persistent audit log, separated into
-- (a) account-scoped platform action log
-- (b) wallet-scoped on-chain TX history
-- Idempotent. Safe to re-run.

alter table audit_logs
  add column if not exists user_id uuid,
  add column if not exists wallet_address text;

alter table movement_requests
  add column if not exists user_id uuid,
  add column if not exists wallet_address text;

-- Backfill user_id from sandbox_sessions
update audit_logs al
   set user_id = ss.user_id
  from sandbox_sessions ss
 where al.session_id = ss.id and al.user_id is null;

update movement_requests mr
   set user_id = ss.user_id
  from sandbox_sessions ss
 where mr.session_id = ss.id and mr.user_id is null;

-- Backfill wallet_address from step_data if available
update movement_requests
   set wallet_address = step_data->>'wallet_address'
 where wallet_address is null
   and step_data ? 'wallet_address';

create index if not exists audit_logs_user_id_idx       on audit_logs(user_id);
create index if not exists audit_logs_wallet_addr_idx   on audit_logs(wallet_address);
create index if not exists movement_user_id_idx          on movement_requests(user_id);
create index if not exists movement_wallet_addr_idx      on movement_requests(wallet_address);
