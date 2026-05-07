-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║   Migration 004 — Remove all mock seed data + block future seeds  ║
-- ║   Wipes the participants/assets the scenario-engine inserts on    ║
-- ║   create_session, and adds triggers that delete any future seeds. ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- Idempotent — safe to re-run.

-- ─── 1. Wipe existing mock participants ────────────────────────────
delete from participants
 where name in (
   'Alexandra Chen','Marcus Webb','Diana Frost','Raj Patel','Sarah Liu'
 );

-- ─── 2. Wipe existing mock assets ──────────────────────────────────
delete from assets
 where name in (
   'BTC Institutional Vault','ETH Treasury Reserve',
   'USDC Liquidity Pool','SOL Operations Fund'
 );

-- ─── 3. Trigger: silently drop any future mock-seed inserts ────────
create or replace function public.block_mock_participants()
returns trigger
language plpgsql
as $$
begin
  if new.name in (
    'Alexandra Chen','Marcus Webb','Diana Frost','Raj Patel','Sarah Liu'
  ) then
    return null;     -- skip the insert; row never lands
  end if;
  return new;
end;
$$;

drop trigger if exists block_mock_participants on participants;
create trigger block_mock_participants
  before insert on participants
  for each row execute function public.block_mock_participants();

create or replace function public.block_mock_assets()
returns trigger
language plpgsql
as $$
begin
  if new.name in (
    'BTC Institutional Vault','ETH Treasury Reserve',
    'USDC Liquidity Pool','SOL Operations Fund'
  ) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists block_mock_assets on assets;
create trigger block_mock_assets
  before insert on assets
  for each row execute function public.block_mock_assets();
