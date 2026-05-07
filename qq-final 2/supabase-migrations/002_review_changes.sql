-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║   Migration 002 — Vercel review changes (items 6-20)              ║
-- ║   Banks, chains, wallets, billing, support, settings, threshold   ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- Run AFTER the original schema. Idempotent — safe to re-run.

create extension if not exists "uuid-ossp";

-- ─── Extend participants for Team page ────────────────────────────
alter table if exists participants
  add column if not exists email text,
  add column if not exists threshold_weight int default 1;

-- ─── Threshold settings (item 12 — Team threshold) ────────────────
create table if not exists threshold_settings (
  org_id uuid primary key references organizations(id) on delete cascade,
  required_approvals int default 2,
  required_reviewers int default 1,
  policy_version text default 'v2.1',
  updated_at timestamptz default now()
);

-- ─── Banks (item 8 — Import Bank page) ────────────────────────────
create table if not exists banks (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade,
  name text not null,
  account_type text default 'Operating',
  account_number_last4 text,
  routing text,
  currency text default 'USD',
  balance numeric default 0,
  status text default 'pending',
  created_at timestamptz default now()
);

-- ─── Chains / Wallets (items 9, 16 — Import Crypto, network selector) ─
create table if not exists chains (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  symbol text not null,
  network text not null,
  is_testnet boolean default false,
  rpc_url text,
  explorer_url text,
  sort_order int default 100
);

create table if not exists wallets (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade,
  chain_id uuid references chains(id),
  label text,
  address text not null,
  type text default 'EOA',
  imported_at timestamptz default now()
);

-- ─── Support tickets (item 11 — Support page) ─────────────────────
create table if not exists support_tickets (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid,
  email text,
  subject text,
  category text,
  message text,
  status text default 'open',
  created_at timestamptz default now()
);

-- ─── Billing (item 13 — Billing page) ─────────────────────────────
create table if not exists plans (
  id text primary key,
  name text,
  price_monthly numeric,
  features text[],
  sort_order int
);

create table if not exists org_subscriptions (
  org_id uuid primary key references organizations(id) on delete cascade,
  plan_id text references plans(id),
  renews_at date,
  updated_at timestamptz default now()
);

create table if not exists invoices (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade,
  number text,
  amount numeric,
  currency text default 'USD',
  status text default 'unpaid',
  issued_at date,
  due_at date,
  pdf_url text,
  created_at timestamptz default now()
);

create table if not exists payment_methods (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade,
  brand text,
  last4 text,
  exp_month int,
  exp_year int,
  is_default boolean default false,
  created_at timestamptz default now()
);

-- ─── User settings (items 14, 19 — Settings page) ─────────────────
create table if not exists user_settings (
  org_id uuid primary key references organizations(id) on delete cascade,
  language text default 'en',
  theme text default 'dark',
  updated_at timestamptz default now()
);

-- ─── SEED DATA ────────────────────────────────────────────────────
insert into chains (name, symbol, network, is_testnet, rpc_url, explorer_url, sort_order) values
  ('Bitcoin','BTC','bitcoin-mainnet',false,'','https://mempool.space',1),
  ('Ethereum','ETH','ethereum-mainnet',false,'https://eth.llamarpc.com','https://etherscan.io',2),
  ('Polygon','MATIC','polygon-mainnet',false,'https://polygon-rpc.com','https://polygonscan.com',3),
  ('Solana','SOL','solana-mainnet',false,'https://api.mainnet-beta.solana.com','https://solscan.io',4),
  ('Arbitrum','ARB','arbitrum-mainnet',false,'https://arb1.arbitrum.io/rpc','https://arbiscan.io',5),
  ('Base','BASE','base-mainnet',false,'https://mainnet.base.org','https://basescan.org',6),
  ('Ethereum Sepolia','ETH','ethereum-sepolia',true,'https://rpc.sepolia.org','https://sepolia.etherscan.io',7),
  ('Polygon Amoy','MATIC','polygon-amoy',true,'https://rpc-amoy.polygon.technology','https://amoy.polygonscan.com',8)
on conflict do nothing;

insert into plans (id, name, price_monthly, features, sort_order) values
  ('starter','Starter',0,
    array['Sandbox access','5 scenarios','Email support','Up to 3 team members'],1),
  ('pro','Pro',499,
    array['Unlimited workflows','Priority support','Custom policy mapping','Workshop included','Up to 25 team members'],2),
  ('enterprise','Enterprise',2499,
    array['Dedicated success manager','Production HSM','Full PQC roadmap','SLA + compliance reviews','Unlimited team members','SAML SSO'],3)
on conflict (id) do nothing;

-- ─── RLS (open for sandbox; lock down before production) ──────────
alter table threshold_settings disable row level security;
alter table banks              disable row level security;
alter table chains             disable row level security;
alter table wallets            disable row level security;
alter table support_tickets    disable row level security;
alter table plans              disable row level security;
alter table org_subscriptions  disable row level security;
alter table invoices           disable row level security;
alter table payment_methods    disable row level security;
alter table user_settings      disable row level security;
