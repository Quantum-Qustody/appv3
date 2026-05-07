# Quantum Qustody — Deploy & Test Guide

End-to-end checklist for getting v3.1 live on Vercel with a clean Supabase backend and working Sepolia transactions.

---

## 1) Update the Supabase database

You only need to run **one new migration** since the original schema:

### Run the migration

1. Open your Supabase project → **SQL Editor** → **New query**.
2. Paste the contents of [`supabase-migrations/002_review_changes.sql`](supabase-migrations/002_review_changes.sql).
3. Click **Run**.

The migration is idempotent — safe to run multiple times. It creates:

| Table | Purpose |
|---|---|
| `threshold_settings` | Team page threshold + policy version |
| `banks` | Import Bank page (coming soon UI) |
| `chains` + `wallets` | Multi-chain wallet imports — seeded with Ethereum Sepolia |
| `support_tickets` | Support page form |
| `plans`, `org_subscriptions`, `invoices`, `payment_methods` | Billing page |
| `user_settings` | Language + theme preferences |

It also seeds the canonical chains (incl. **Ethereum Sepolia**) and three plans (Starter / Pro / Enterprise).

### Verify

```sql
select count(*) from chains where network = 'ethereum-sepolia';   -- expect 1
select count(*) from plans;                                        -- expect 3
```

---

## 2) Clean previous users (start fresh)

Run this in the SQL editor when you want to wipe all sandbox data — sessions, participants, assets, audit logs, transactions, banks, wallets, etc. — and remove signed-up users from `auth.users`.

⚠️ **Destructive — local sandbox data only**. Do not run on production.

```sql
-- Truncate app data first (CASCADE clears child rows)
truncate table
  audit_logs, evidence_sections, evidence_outputs,
  movement_requests, scenario_progress, sandbox_sessions,
  participants, assets, wallets, banks,
  invoices, payment_methods, org_subscriptions,
  threshold_settings, user_settings, support_tickets,
  organizations
restart identity cascade;

-- Delete auth users (requires service role — run from SQL editor as admin)
delete from auth.users;
```

If `auth.users` deletion errors out, do it from the Supabase dashboard:
**Authentication → Users → select all → Delete** (or use the Admin API).

After cleaning, re-run the seed inserts at the bottom of `002_review_changes.sql` if you want default chains/plans back:

```sql
-- Re-seed chains + plans (idempotent — see migration file for the full insert list)
```

---

## 3) Local preview before deploying

```bash
cd "/Users/gdbmood/Desktop/appv3/qq-final 2"
npm install
npm run dev
```

Open the printed URL (usually `http://localhost:5173` or `5174`).

---

## 4) Deploy to Vercel

### First-time setup

1. Push to GitHub (if not already):
   ```bash
   git add . && git commit -m "v3.1 Sepolia + bento dashboard"
   git push origin main
   ```
2. Go to https://vercel.com/new → **Import** the repo.
3. Vercel auto-detects Vite. Confirm:
   - **Framework**: Vite
   - **Build command**: `npm run build`
   - **Output directory**: `dist`
4. Add **Environment Variables**:
   | Key | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://YOUR-PROJECT.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | the anon/public key from Supabase → Settings → API |
5. Click **Deploy**.

### Subsequent deploys

Just `git push` — Vercel rebuilds automatically. To redeploy without code changes (e.g. after env-var change), click **Redeploy** in the Vercel dashboard.

### Force-clear cache after a deploy

If you don't see your changes, Vercel caches aggressively at the edge. In the dashboard:
**Deployments → ⋯ → Redeploy → uncheck "Use existing build cache"**.

---

## 5) Test on-chain transactions (Sepolia)

The Governed Movement page is now wired to **real Ethereum Sepolia testnet** via MetaMask.

### Prereqs

1. Install [MetaMask](https://metamask.io/download/) browser extension.
2. Fund your address with **Sepolia ETH** — there are four faucets linked directly on the Governed Movement page (Google Cloud, Alchemy, QuickNode, Infura). 0.05 SEP is plenty for testing.

### Test flow

1. Sign up / sign in to the app.
2. Complete sandbox setup (organisation context, etc.).
3. Click **GOVERNED MOVEMENT** in the sidebar.
4. Click **CONNECT WALLET** — MetaMask will prompt; approve.
5. If you're not on Sepolia, click **SWITCH TO SEPOLIA** (or accept the auto-switch prompt).
6. Your live ETH + WETH balance appears.
7. Pick an action:
   - **SEND** — enter destination + amount, click `SUBMIT_SEND_ON_SEPOLIA`. MetaMask prompts; signs; tx broadcasts. Etherscan link appears.
   - **SWAP** — wraps ETH → WETH on the canonical Sepolia WETH9 contract `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14`. Real on-chain action.
   - **BRIDGE** — placeholder loopback (sends to self) until cross-chain integration is wired up.
8. Once confirmed, the tx hash + status persists to `movement_requests` and shows up under **Evidence Viewer → Transactions**, exportable as CSV/JSON.

### What's actually on-chain vs simulated

| Action | Sepolia? | Notes |
|---|---|---|
| Connect Wallet | ✅ Real | EIP-1193 via `window.ethereum` |
| Read Balance | ✅ Real | Public Sepolia RPC |
| SEND ETH | ✅ Real | `signer.sendTransaction()` |
| SWAP (ETH→WETH) | ✅ Real | WETH9 `deposit()` |
| BRIDGE | ⚠️ Demo | Loopback to self, awaiting real bridge SDK |
| Scenario flow | ⚠️ Sim | Existing edge-function evaluation paths |

---

## 6) Quick sanity checks after deploy

- [ ] Landing page loads at the Vercel URL
- [ ] Sign up flow creates a row in `auth.users` and `sandbox_sessions`
- [ ] Dashboard shows real org name, QSAFETY atom animates
- [ ] `WHY QUANTUM SAFE?` button → How It Works → scrolls to Quantum Safety module
- [ ] Sidebar collapses to drawer on mobile (`Cmd+Shift+M` in Chrome DevTools to toggle)
- [ ] MetaMask connect → Sepolia balance reads
- [ ] SEND a tiny tx (e.g. 0.0001 SEP to your own address) → confirms → appears in Evidence Viewer Transactions
- [ ] CSV export from Transactions tab downloads a valid file

---

## 7) Common gotchas

**"Supabase env vars missing" in console** → confirm `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are set in Vercel and **Production** environment is selected, then redeploy.

**MetaMask "wrong network"** → click `SWITCH TO SEPOLIA`, or open MetaMask manually and pick "Sepolia test network".

**Faucet rate-limited** → try a different one. Most allow one claim per address per day.

**TX stuck pending forever** → Sepolia gas is sometimes set wrong. Try increasing gas in MetaMask or speeding up the transaction.

**"Insufficient funds for gas"** → faucet first. Gas on Sepolia is paid in SEP (Sepolia ETH).

---

Last updated: v3.1 (Dashboard bento redesign + Sepolia integration + Quantum Safety module).
