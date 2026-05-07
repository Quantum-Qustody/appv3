# Team Email Invitations — Setup

How to enable real "invite by email → click → join" for the Team page.

## What's involved

1. **Migration 003** — adds `team_invitations` table + auto-link trigger.
2. **Edge function `team-invite`** — creates invite rows + sends email via Supabase Auth.
3. **Frontend** — already wired (Team page → INVITE_BY_EMAIL).

When someone clicks the email link, they sign up via Supabase Auth → trigger fires → an active `participants` row is created in your org.

---

## Step 1 — Run the migration

In Supabase **SQL Editor → New query**, paste the contents of [`supabase-migrations/003_team_invitations.sql`](supabase-migrations/003_team_invitations.sql) and **Run**.

Verify:

```sql
select count(*) from team_invitations;          -- 0
select proname from pg_proc where proname = 'accept_team_invitation';   -- 1 row
select tgname from pg_trigger where tgname = 'on_auth_user_created_invite';   -- 1 row
```

## Step 2 — Deploy the edge function

You have two options.

### Option A — Supabase CLI (recommended)

```bash
brew install supabase/tap/supabase
cd "/Users/gdbmood/Desktop/appv3/qq-final 2"
supabase login
supabase link --project-ref jelyszovakrmwnjplphz
supabase functions deploy team-invite --no-verify-jwt
```

The function is at `supabase/functions/team-invite/index.ts`.

### Option B — Supabase dashboard (paste-in)

1. Supabase dashboard → **Edge Functions** → **+ Create a new function**.
2. Name: `team-invite`.
3. Toggle **Verify JWT with legacy secret** **OFF** (or leave on — both work; we read the caller's JWT manually).
4. Copy the contents of `supabase/functions/team-invite/index.ts` and paste it in.
5. **Deploy**.

## Step 3 — Set the function's environment variables

In Supabase dashboard → **Edge Functions → team-invite → Secrets**:

| Key | Value |
|---|---|
| `SUPABASE_URL` | already set (auto) |
| `SUPABASE_SERVICE_ROLE_KEY` | already set (auto, from Settings → API) |
| `SITE_URL` | `https://www.quantumqustody.com` |

The first two are auto-injected by Supabase. You only need to add **`SITE_URL`**.

## Step 4 — Configure email sender (Supabase Auth)

By default Supabase's free tier sends invitation emails from `noreply@mail.app.supabase.io` — works for testing but ends up in spam more often than not. For production:

1. Supabase dashboard → **Authentication → Emails → SMTP Settings**.
2. Enable **Custom SMTP** and configure your sender (Postmark, Resend, SendGrid, AWS SES — any SMTP provider).
3. Set the sender to something like `noreply@quantumqustody.com`.

You can also customise the **email template** at **Authentication → Emails → Templates → "Invite user"** so the message reads "You've been invited to Quantum Qustody by ${OrgName}" instead of the default Supabase wording.

The redirect URL the email links to will be `https://www.quantumqustody.com/?invite=TOKEN` — landing on your app where they sign up.

## Step 5 — Whitelist the redirect URL

Supabase blocks unrecognised redirect targets. Add yours:

1. **Authentication → URL Configuration → Redirect URLs**.
2. Add `https://www.quantumqustody.com/**` (and `http://localhost:5173/**` for local testing).
3. **Save**.

## Step 6 — Test the flow

1. Open https://www.quantumqustody.com → sign in to your existing account.
2. Sidebar → **TEAM** → **INVITE_BY_EMAIL**.
3. Enter a test email (use one you own — Gmail, hide.com, mailinator, etc.).
4. Pick a role and function → **SEND_INVITATION**.
5. Check the inbox — you should receive a Supabase invitation email within ~30 seconds.
6. Click the link → lands on `https://www.quantumqustody.com/?invite=TOKEN` and asks for a password.
7. Set a password → sign in → **the trigger automatically creates an active `participants` row in your org**.
8. Go back to your admin tab → Team page → the new member appears under ACTIVE MEMBERS.

## How the auto-link works under the hood

```
[Inviter]
   │
   ├─ Team page → INVITE_BY_EMAIL → call team-invite edge function
   │
   ▼
[Edge Function team-invite]
   │
   ├─ INSERT into team_invitations (status: pending, token: random)
   │
   ├─ supabase.auth.admin.inviteUserByEmail({
   │     email,
   │     data: { invite_token: <token> },
   │     redirectTo: https://app/?invite=<token>
   │   })
   │
   ▼
[Supabase Auth sends email]

[Invitee clicks link]
   │
   ├─ Lands on app, sets password → auth.users INSERT
   │  (raw_user_meta_data contains invite_token)
   │
   ▼
[Trigger on_auth_user_created_invite]
   │
   ├─ Calls accept_team_invitation(token, user_id)
   │
   ├─ Looks up team_invitations row
   ├─ INSERT participants(org_id, name, email, role, fn, weight, status='active')
   ├─ UPDATE team_invitations SET status='accepted'
   │
   ▼
[Done — invitee is now a real team member]
```

## Troubleshooting

**No email received** → check Supabase → **Authentication → Logs**. The free-tier sender is rate-limited (4 emails/hour). For testing, configure custom SMTP (Resend has a free 100 emails/day tier).

**"function returned non-2xx" in browser console** → Edge function not deployed yet, or `SITE_URL` env var missing. Check Supabase → Edge Functions → team-invite → Logs.

**Invitee signs up but no participants row appears** → trigger not firing. Verify with:
```sql
select tgname, tgenabled from pg_trigger where tgname = 'on_auth_user_created_invite';
```
Should show `tgname = on_auth_user_created_invite`, `tgenabled = O` (enabled).

**Token expired** → invitations expire after 14 days. Click RESEND on the Team page → fresh token, new email.

**"redirect URL not allowed"** → add the URL in Supabase → Authentication → URL Configuration → Redirect URLs.

**Caller JWT missing** → the edge function reads `Authorization: Bearer <jwt>` from the request. The frontend's `callFunction()` helper attaches it automatically; if you call manually via curl, pass `-H "Authorization: Bearer <token>"`.

---

After Step 1–5 are done once, every invitation thereafter is just: Team page → INVITE_BY_EMAIL → Send.
