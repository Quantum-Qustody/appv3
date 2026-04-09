# Quantum Qustody — MVP Alpha Sandbox

Full-stack scenario-led institutional evaluation sandbox.

## Stack
- **Frontend:** React 18 + Vite
- **Backend:** Supabase (Postgres + Auth + Edge Functions + Realtime)
- **Deployment:** Vercel

## Environment Variables

Create `.env` in project root (or set in Vercel Settings → Environment Variables):

```
VITE_SUPABASE_URL=https://jelyszovakrmwnjlplphz.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

## Local Development

```bash
npm install
npm run dev
```

## Deploy to Vercel

1. Push to GitHub
2. Import repo in Vercel
3. Set Root Directory to `qq-final` (or wherever this folder sits)
4. Add environment variables in Vercel Settings
5. Deploy

## Architecture

- `src/App.jsx` — Main app with Supabase integration
- Database schema is in the Supabase project (already deployed)
- Edge functions are deployed to Supabase (scenario-engine, evidence-generate, audit-log)
