// Supabase Edge Function: team-invite
//
// Actions:
//   { action: "send",   org_id, email, scenario_role, institution_fn, threshold_weight }
//   { action: "resend", invite_id }
//   { action: "revoke", invite_id }
//   { action: "list",   org_id }
//
// Uses Supabase's built-in email (auth.admin.inviteUserByEmail).
// Requires SUPABASE_SERVICE_ROLE_KEY in the function's env.
//
// Deploy:
//   supabase functions deploy team-invite --no-verify-jwt
//   (or with JWT — see below)

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function makeToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const SITE_URL = Deno.env.get("SITE_URL") || "https://www.quantumqustody.com";

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ error: "function missing env: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Identify the caller (the inviter)
  const auth = req.headers.get("Authorization") || "";
  const callerJwt = auth.replace(/^Bearer\s+/i, "");
  let inviterId: string | null = null;
  if (callerJwt) {
    const { data: u } = await admin.auth.getUser(callerJwt);
    inviterId = u?.user?.id ?? null;
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON" }, 400); }
  const action = String(body?.action || "send");

  // ── LIST ─────────────────────────────────────────────────────────
  if (action === "list") {
    const { org_id } = body;
    if (!org_id) return json({ error: "org_id required" }, 400);
    const { data, error } = await admin.from("team_invitations")
      .select("*").eq("org_id", org_id).order("created_at", { ascending: false });
    if (error) return json({ error: error.message }, 500);
    return json({ invitations: data ?? [] });
  }

  // ── REVOKE ───────────────────────────────────────────────────────
  if (action === "revoke") {
    const { invite_id } = body;
    if (!invite_id) return json({ error: "invite_id required" }, 400);
    const { error } = await admin.from("team_invitations")
      .update({ status: "revoked" }).eq("id", invite_id).eq("status", "pending");
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  // ── RESEND ───────────────────────────────────────────────────────
  if (action === "resend") {
    const { invite_id } = body;
    if (!invite_id) return json({ error: "invite_id required" }, 400);
    const { data: inv, error: e1 } = await admin.from("team_invitations")
      .select("*").eq("id", invite_id).single();
    if (e1 || !inv) return json({ error: e1?.message || "not found" }, 404);
    if (inv.status !== "pending") return json({ error: `invitation is ${inv.status}` }, 400);
    const redirectTo = `${SITE_URL}/?invite=${encodeURIComponent(inv.token)}`;
    const { error: e2 } = await admin.auth.admin.inviteUserByEmail(inv.email, {
      data: { invite_token: inv.token, full_name: body.full_name || "" },
      redirectTo,
    });
    if (e2) return json({ error: e2.message }, 500);
    return json({ ok: true });
  }

  // ── SEND ─────────────────────────────────────────────────────────
  if (action === "send") {
    const { org_id, email, scenario_role, institution_fn, threshold_weight, full_name } = body;
    if (!org_id || !email) return json({ error: "org_id and email required" }, 400);

    const token = makeToken();

    const { data: inv, error: e1 } = await admin.from("team_invitations").insert({
      org_id,
      email: email.toLowerCase(),
      scenario_role: scenario_role || "Requester",
      institution_fn: institution_fn || null,
      threshold_weight: threshold_weight || 1,
      invited_by: inviterId,
      status: "pending",
      token,
    }).select().single();

    if (e1) return json({ error: e1.message }, 500);

    const redirectTo = `${SITE_URL}/?invite=${encodeURIComponent(token)}`;
    const { error: e2 } = await admin.auth.admin.inviteUserByEmail(email.toLowerCase(), {
      data: { invite_token: token, full_name: full_name || "" },
      redirectTo,
    });

    if (e2) {
      // If the user already exists, fall back to magic-link sign-in with metadata
      if (/already.*registered|already.*exists/i.test(e2.message)) {
        const { error: e3 } = await admin.auth.signInWithOtp({
          email: email.toLowerCase(),
          options: { data: { invite_token: token }, emailRedirectTo: redirectTo },
        });
        if (e3) return json({ error: `existing user, magic-link failed: ${e3.message}`, invite: inv }, 500);
        return json({ ok: true, invite: inv, mode: "existing_user_magic_link" });
      }
      return json({ error: e2.message, invite: inv }, 500);
    }

    return json({ ok: true, invite: inv, mode: "new_user_invite" });
  }

  return json({ error: `unknown action: ${action}` }, 400);
});
