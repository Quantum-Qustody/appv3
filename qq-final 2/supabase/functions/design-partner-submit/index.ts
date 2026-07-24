// Supabase Edge Function: design-partner-submit
//
// Stores a completed Design Partner discovery submission and emails a PDF of
// every question + answer to Quantum Qustody.
//
// Body: { partner, partner_name, respondent, submitted_at, answered, total,
//         answers, sections, pdf_base64, filename }
//
// Required secrets (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY   — Resend key with sending access on the verified domain
// Optional:
//   DP_MAIL_FROM     — default "Quantum Qustody <noreply@moods.build>"
//   DP_MAIL_TO       — default "gdb@quantumqustody.com"
//
// Deploy:  supabase functions deploy design-partner-submit
// (Keep JWT verification ON — only signed-in design partners submit.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const {
    partner = "unknown", partner_name = "", respondent = null,
    submitted_at = new Date().toISOString(), answered = 0, total = 0,
    consent_accepted_at = null,
    answers = {}, sections = [], pdf_base64 = null,
    filename = `QQ-Discovery-${new Date().toISOString().slice(0, 10)}.pdf`,
  } = body ?? {};

  // ── 1. Store ───────────────────────────────────────────────────────
  let stored = false, store_error: string | null = null;
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { error } = await admin.from("design_partner_responses").insert({
      partner, respondent_email: respondent, answers, sections,
      answered_count: answered, total_questions: total,
      consent_accepted_at,
    });
    if (error) store_error = error.message; else stored = true;
  } catch (e) {
    store_error = String((e as Error)?.message ?? e);
  }

  // ── 2. Email the PDF ───────────────────────────────────────────────
  let emailed = false, email_error: string | null = null;
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const MAIL_FROM = Deno.env.get("DP_MAIL_FROM") || "Quantum Qustody <noreply@moods.build>";
  // Comma-separated list — every recipient gets the transcript + PDF.
  const MAIL_TO = (Deno.env.get("DP_MAIL_TO") ||
    "gdb@moodglobalservices.com,chee@quantumqustody.com,sohil@quantumqustody.com")
    .split(",").map((s) => s.trim()).filter(Boolean);

  if (!RESEND_API_KEY) {
    email_error = "RESEND_API_KEY is not set — submission stored but not emailed.";
  } else {
    try {
      // Readable HTML transcript in the body, full PDF attached.
      const blocks = (sections as any[]).map((s) => {
        const rows = (s.items || []).map((it: any) =>
          `<tr>
             <td style="padding:8px 10px;border-bottom:1px solid #eee;color:#444;font-size:12px;width:52%">${esc(it.question)}</td>
             <td style="padding:8px 10px;border-bottom:1px solid #eee;color:#111;font-size:12px;white-space:pre-wrap">${esc(it.answer)}</td>
           </tr>`).join("");
        return `<h3 style="margin:22px 0 6px;font:600 14px system-ui;color:#7c3aed">${esc(s.section)}</h3>
                <table style="width:100%;border-collapse:collapse;font-family:system-ui">${rows}</table>`;
      }).join("");

      const html = `
        <div style="font-family:system-ui;max-width:760px;margin:0 auto;color:#111">
          <div style="background:#7c3aed;color:#fff;padding:20px 24px;border-radius:6px 6px 0 0">
            <div style="font:700 18px system-ui">Design Partner Discovery — submitted</div>
            <div style="font-size:13px;opacity:.9;margin-top:4px">${esc(partner_name || partner)}</div>
          </div>
          <div style="border:1px solid #eee;border-top:none;padding:20px 24px;border-radius:0 0 6px 6px">
            <p style="font-size:13px;color:#444;margin:0 0 14px">
              <b>Respondent:</b> ${esc(respondent || "unknown")}<br/>
              <b>Submitted:</b> ${esc(submitted_at)}<br/>
              <b>Completed:</b> ${esc(answered)} of ${esc(total)} questions<br/>
              <b>Confidentiality accepted:</b> ${esc(consent_accepted_at || "not recorded")}<br/>
              <b>Stored in Supabase:</b> ${stored ? "yes" : "no — " + esc(store_error)}
            </p>
            <p style="font-size:12px;color:#666;margin:0 0 6px">Full transcript attached as PDF.</p>
            ${blocks}
          </div>
        </div>`;

      const payload: Record<string, unknown> = {
        from: MAIL_FROM,
        to: MAIL_TO,
        subject: `Design Partner Discovery — ${partner_name || partner} (${answered}/${total})`,
        html,
      };
      if (pdf_base64) payload.attachments = [{ filename, content: pdf_base64 }];

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) emailed = true;
      else email_error = `Resend ${res.status}: ${(await res.text()).slice(0, 300)}`;
    } catch (e) {
      email_error = String((e as Error)?.message ?? e);
    }
  }

  return json({ ok: true, stored, store_error, emailed, email_error });
});
