// ╔═══════════════════════════════════════════════════════════════════╗
// ║  Design Partner — gated discovery intake                          ║
// ║  Q² × Chayne — Design Partner Discovery (Technical & Operations)   ║
// ║  Gate: Supabase Auth + design_partner role. Answers → Supabase.    ║
// ║  On submit: PDF of every Q&A generated and emailed to Q².          ║
// ╚═══════════════════════════════════════════════════════════════════╝
import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "./supabaseClient.js";

const DRAFT_KEY = "qq_dp_chayne_v1";
const CONSENT_KEY = "qq_dp_chayne_consent_v1";
const SANDBOX_URL = "https://quantumqustody.com";

// ─── Partner context ───────────────────────────────────────────────
export const PARTNER = {
  id: "chayne",
  name: "Chayne Global Management",
  fund: "Chayne Modern Yield Fund, L.P.",
  blurb:
    "SEC-registered Exempt Reporting Adviser running the Chayne Modern Yield Fund, L.P. — a Reg D 506(c) offering (99 accredited investors, $250K minimum) targeting 10–12% net with quarterly liquidity. Capital runs in three sleeves: Core 70% (short-duration private and public credit, 30–360 days), Alpha 20% (tactical yield and subordinated credit), and Opportunistic 10% (liquid yield buffer supporting redemptions). 1.5% all-in fees, 14-day redemption notice, 360-day maximum position duration, and concentration limits of 5% per end-obligor and 15% per platform. The stack pairs Salt (MPC custody) and post-quantum ML-DSA (FIPS 204) signing with Parsera for independent NAV and XDC as the DLT network.",
};

export const FORM_TITLE = "Q² × Chayne — Design Partner Discovery (Technical & Operations)";
export const FORM_INTRO = `Prepared for Chayne Global Management — Modern Yield Fund.

This intake helps us map how digital assets move through the Fund, who authorizes those movements, and how you prove control today — so the Q² overlay is designed around your operations rather than a generic template. Where a specific is sensitive, answer at whatever fidelity your security policy allows; a redacted or whiteboard-level answer is enough.

Q² is a non-custodial governance and evidence overlay across three pillars — Governed Movement, Asset Boundary, and Defensible Evidence. We never hold keys, never take signing authority, and pre-pilot work uses test assets only.

Time: about 30–40 minutes. Confidential, for the Q² × Chayne engagement only. Questions: info@quantumqustody.com`;

// Shown directly under the title, above the progress bar.
export const REASSURANCE = `Nothing in this questionnaire asks for production private keys or signing authority, customer personal data, or source-code access. Q² is non-custodial by design. Stage 1 runs entirely in our sandbox on synthetic data, with zero touch on your systems. Share at whatever fidelity your security policy allows — a redacted or whiteboard-level answer is enough for this stage.`;
export const REASSURANCE_SHORT = `If you are short on time, Sections 2, 3 and 8 matter most.`;

// Consent gate — must be accepted before the questionnaire opens.
export const CONFIDENTIALITY = `Quantum Qustody Inc. ("Q²") is a Delaware corporation. We expect to enter into a mutual non-disclosure agreement, which will apply retroactively to everything exchanged through this form. In the meantime, both parties agree to treat the other's non-public information as confidential, to use it solely to evaluate and scope a potential design partner engagement, and to disclose it only to personnel and professional advisers bound by equivalent obligations — excluding information that is public, already known, independently developed, or required to be disclosed by law. Please share only at the fidelity your own policies allow, and do not submit credentials, private keys, or personal data. This creates no obligation on either party to proceed, and transfers no intellectual property. Governed by Delaware law.

Q² will protect your information using at least the same degree of care it applies to its own confidential information, and no less than reasonable care.

We retain your responses for the duration of the evaluation and will delete or return them on written request, subject to any applicable legal retention requirement.`;

// ─── The questionnaire ─────────────────────────────────────────────
// t: short | para | choice | checks    req: required    other: free-text "Other"
export const SECTIONS = [
  {
    n: 1,
    title: "Respondents & entities in scope",
    why: "So we scope to the right entities and route follow-ups to the right person.",
    qs: [
      { id: "s1q1", t: "short", req: true, q: "Your name and role." },
      { id: "s1q2", t: "short", req: true, q: "Best technical counterpart for integration questions (name / role / email)." },
      { id: "s1q3", t: "para", q: "Entities in scope. We assume Chayne Modern Yield Fund, L.P. (the moving entity) and Chayne Global Management, LLC (adviser / ERA), with an offshore feeder under evaluation. Please confirm or correct, and name any other entity that touches asset movements." },
      { id: "s1q4", t: "short", q: "Scale, as ranges — ranges are fine: number of LPs · AUM · headcount (total / technical / compliance-ops)." },
    ],
  },
  {
    n: 2,
    title: "How assets move (Governed Movement)",
    why: "The movement lifecycle — who can initiate, who approves, and where that breaks — is the core of what Q² governs.",
    qs: [
      { id: "s2q0", t: "para", q: "Before we walk through the detail: rank your top three operational or compliance pain points around how assets move, who can authorize movements, and how you prove control." },
      { id: "s2q1", t: "para", q: "Walk us through the life of an LP subscription in USDC/USDT, from wire or stablecoin receipt to capital deployed — who touches it, where, and with what authority. (Per your website, processing is ~48h after KYC and receipt — please correct us if that's out of date.)" },
      { id: "s2q2", t: "para", q: "Walk us through a redemption / distribution out to an LP, across the 14-day notice window and 10-business-day settlement your site describes — who initiates, who approves, and how the payout is signed and released. Please correct us if that's out of date." },
      { id: "s2q3", t: "para", q: "How is capital moved into and out of the three sleeves (Core / Alpha / Opportunistic) — especially the Opportunistic sleeve's on-chain positions (overcollateralized lending, aggregated stablecoin yield)? Who authorizes those movements?" },
      { id: "s2q4", t: "short", q: "How many people can authorize an asset movement today (individually or jointly), and what is the approval threshold (e.g., M-of-N)?" },
      { id: "s2q5", t: "checks", other: true, q: "Where do approvals actually happen today?", opts: ["Salt policy console", "Internal tool / app", "Email", "Chat (Slack / Signal / etc.)", "Verbal / call", "Ticketing system"] },
      { id: "s2q6", t: "para", q: "Which individuals, if simultaneously unavailable, would freeze the ability to move assets? Has that ever come close to happening?" },
      { id: "s2q7", t: "choice", q: "Do any automated systems, bots, or AI agents currently hold — or are planned to hold — authority to initiate or approve movements (e.g., rebalancing the Opportunistic sleeve, depositing to yield venues)?", opts: ["Yes, today", "Planned", "No"] },
      { id: "s2q8", t: "para", q: "If yes or planned above: what can they do without a human, and under what limits (value caps, allowlisted destinations, time windows)? Where is that written down?" },
    ],
  },
  {
    n: 3,
    title: "Custody & key management (Salt / MPC)",
    why: "Q² overlays your existing signing stack — we need to know it precisely to integrate without disturbing it.",
    qs: [
      { id: "s3q1", t: "choice", q: "Salt is your MPC key-management provider. How is it deployed?", opts: ["SaaS", "Self-hosted", "Hybrid", "Not sure"] },
      { id: "s3q2", t: "para", q: "Your signer model today: who holds key shares, the M-of-N threshold(s) in force, and where signing policy is configured (in Salt, or elsewhere)?" },
      { id: "s3q3", t: "para", q: "What can Salt's policy layer express and enforce today (thresholds, allowlists, per-asset or per-destination limits, time locks)? Where does it fall short of what you would want to enforce?" },
      { id: "s3q4", t: "short", q: "Who administers policy changes in Salt, and how is a policy change recorded or evidenced today?" },
      { id: "s3q5", t: "para", q: "Key ceremony, rotation, and re-key practice, at the level you can share: how often keys rotate, what triggers a rotation, and who runs it." },
      { id: "s3q6", t: "para", q: "Wallet / account topology: approximately how many wallets or accounts, and how are they segregated (treasury vs. client / LP-facing vs. per-sleeve vs. per-venue)?" },
      { id: "s3q7", t: "para", q: "Besides Salt, do any other custody, wallet, or signing arrangements touch Fund or adviser assets — hardware wallets, exchange-held balances, or a third-party custodian?" },
    ],
  },
  {
    n: 4,
    title: "Chains, assets & standards (XDC + stablecoins)",
    why: "The chains, account model, and asset standards decide how Q² enforces and evidences movements at the account layer.",
    qs: [
      { id: "s4q1", t: "para", q: "Your site lists XDC as the DLT network — please correct us if that's out of date. Is Fund settlement on XDC, on Ethereum or other chains, or multi-chain? Which chain carries which flow (subscriptions, redemptions, sleeve positions)?" },
      { id: "s4q2", t: "para", q: "Stablecoins in use and the chains they settle on (e.g., USDC on XDC / Ethereum; USDT on …). List any others." },
      { id: "s4q3", t: "choice", q: "Account model on-chain: are Fund wallets EOAs, smart accounts / contract wallets, or a mix?", opts: ["EOA", "Smart accounts", "Mix", "Not sure"] },
      { id: "s4q4", t: "choice", q: "Any account-abstraction exposure or plans (ERC-4337, or EIP-7702-style EOA delegation)? Q² enforces Governed Movement at the account layer, so this materially affects the integration pattern.", opts: ["Using today", "Planned", "No", "Not sure"] },
      { id: "s4q5", t: "para", q: "On-chain venues the Opportunistic sleeve interacts with (lending protocols, stablecoin yield venues) — names, chains, and roughly how those interactions are executed (direct contract calls, via a platform, via a counterparty)." },
      { id: "s4q6", t: "para", q: "Any tokenized positions or on-chain representations of Fund assets (e.g., on XDC) we should account for?" },
    ],
  },
  {
    n: 5,
    title: "Post-quantum posture (ML-DSA / FIPS 204)",
    why: "You already state post-quantum signing on ML-DSA (FIPS 204) — the same standard family Q² is built on (ML-DSA-65) — so we want to map your posture precisely and avoid duplicating or conflicting with it.",
    qs: [
      { id: "s5q1", t: "choice", q: "Post-quantum signing on ML-DSA (FIPS 204): is this live in production today, in staging, or on the roadmap?", opts: ["Live in production", "Staging / testing", "Roadmap", "Not sure"] },
      { id: "s5q2", t: "choice", q: "Is the ML-DSA signing provided through Salt, built in-house, or another provider?", opts: ["Salt", "In-house", "Other", "Not sure"] },
      { id: "s5q3", t: "short", q: "Which ML-DSA parameter set — ML-DSA-44, -65, or -87? (If unknown, say so.)" },
      { id: "s5q4", t: "choice", q: "Is signing PQ-only, or a classical + PQ hybrid (e.g., ECDSA / EdDSA + ML-DSA)?", opts: ["PQ-only", "Hybrid", "Not sure"] },
      { id: "s5q5", t: "para", q: "Where is the ML-DSA signature verified — does XDC (or your settlement chain) verify it on-chain, or is it an off-chain attestation over the transaction?" },
      { id: "s5q6", t: "para", q: "Your crypto-agility / re-key plan: how would you rotate to a new algorithm or parameter set, who decides, and how is that rotation evidenced?" },
    ],
  },
  {
    n: 6,
    title: "Movement profile & boundaries (Asset Boundary)",
    why: "Movement types, values, and your concentration limits determine which governance scenarios we pre-build and where boundaries get enforced.",
    qs: [
      { id: "s6q1", t: "checks", other: true, q: "Movement types today (check all that apply):", opts: ["LP subscriptions in", "Redemptions / distributions out", "Sleeve deployment / rebalancing", "On-chain yield / lending deposits & withdrawals", "Treasury / operating movements", "Fee movements"] },
      { id: "s6q2", t: "short", q: "Approximate monthly movement count and total value range across all types (ranges are fine)." },
      { id: "s6q3", t: "short", q: "Typical vs. peak single-movement value, and any internal threshold that already triggers extra scrutiny or approval." },
      { id: "s6q4", t: "choice", q: "Per your website, no single end-obligor exceeds 5% of NAV and no platform exceeds 15% — please correct us if that's out of date. Are these enforced at the moment of movement, or monitored / reported after the fact?", opts: ["Enforced at movement", "Monitored after", "Both", "Not sure"] },
      { id: "s6q5", t: "para", q: "Movement types you do not do today but plan to within 12 months (e.g., the offshore feeder's flows, new venues, new chains)?" },
      { id: "s6q6", t: "para", q: "What must never be blocked or delayed by a governance layer — which movement, under what conditions, has to complete even if a check fails? And what response time would you consider acceptable for an approval step?" },
    ],
  },
  {
    n: 7,
    title: "Systems & integration surfaces",
    why: "The systems that touch a movement are our integration points; their APIs and constraints shape the pattern we propose. We start read-only.",
    qs: [
      { id: "s7q1", t: "checks", other: true, q: "Systems that touch the movement lifecycle (check all that apply):", opts: ["Investor platform (KYC + subscription docs)", "Parsera (fund administration / NAV)", "Salt (MPC signing)", "Accounting / sub-ledger", "Banking / USD wire rails", "Treasury tooling", "Compliance screening (AML / sanctions / Travel Rule)", "Data warehouse / BI"] },
      { id: "s7q2", t: "para", q: "Investor platform: built in-house or a vendor product (which)? Does it expose an API or webhooks for subscription / redemption events?" },
      { id: "s7q3", t: "para", q: "Parsera: how does it receive position and transaction data today (API, file drop, manual), and at what cadence? Is there an API we can read from?" },
      { id: "s7q4", t: "para", q: "Salt: what transaction / policy events can it emit (webhooks, event stream, or polled API)? Push or poll?" },
      { id: "s7q5", t: "checks", other: true, q: "Integration / auth standards you require for a new tool:", opts: ["OAuth 2.0", "mTLS", "IP allowlisting", "SSO (SAML / OIDC)", "SCIM", "API keys"] },
      { id: "s7q6", t: "short", q: "Your secrets-handling standard for third-party integrations (vault, KMS, etc.), and any hard constraints." },
    ],
  },
  {
    n: 8,
    title: "Evidence & regulatory profile (Defensible Evidence)",
    why: "We pre-map our evidence templates to your specific obligations, so the workshop starts from your reality — Parsera, your auditor, your LPs, and the SEC — not a generic deck.",
    qs: [
      { id: "s8q1", t: "para", q: "List everyone who asks you to prove control over asset movements — SEC (as ERA), your annual GAAP auditor, Parsera, LPs (on demand), banking partners, insurers — and what each asks for, in what format, how often." },
      { id: "s8q2", t: "para", q: "Your site describes “three reads on every position” (Administrator, Auditor, LP read the same record) — please correct us if that's out of date. How is that consistency produced today, and where does it break or take manual effort?" },
      { id: "s8q3", t: "short", q: "Take the most recent control-evidence request: how many hours, across which teams and systems, did it take to answer?" },
      { id: "s8q4", t: "para", q: "Where do you rely on screenshots or manual attestations today, and which of those would you least like to defend to an examiner?" },
      { id: "s8q5", t: "para", q: "Selective disclosure: is there anything you must prove to one party without revealing everything to them (e.g., prove a movement was authorized to an auditor without exposing LP identities; prove reserves without exposing positions)? To whom?" },
      { id: "s8q6", t: "short", q: "Audit & attestation cycle: annual GAAP auditor (who / when), any SOC / ISAE attestations held or demanded of you, Parsera's review cadence." },
      { id: "s8q7", t: "short", q: "Upcoming regulatory or reporting events in the next 12 months (ERA filings, examinations, feeder launch, attestation renewals)." },
      { id: "s8q8", t: "para", q: "Data retention and residency requirements for movement / evidence records: any constraint on where your data can be stored or processed (US-based adviser today, and anything the offshore feeder would add if it proceeds)?" },
      { id: "s8q9", t: "para", q: "Which regimes and supervisors do you answer to, and what registrations or authorizations do you hold or have in application — SEC as ERA, any state regimes, AML obligations, and the offshore feeder's jurisdiction if it proceeds?" },
      { id: "s8q10", t: "para", q: "Which obligations consume the most compliance or operations hours to evidence today?" },
    ],
  },
  {
    n: 9,
    title: "Environments, test data & security handshake",
    why: "To get you hands-on fast and safely — Stage 1 defaults to our sandbox with synthetic data, zero touch on your systems.",
    qs: [
      { id: "s9q1", t: "choice", q: "Do you have a testnet / staging environment we could use (e.g., XDC Apothem testnet, or a Salt test tenant)?", opts: ["Yes", "Partially", "No", "Not sure"] },
      { id: "s9q2", t: "choice", q: "Are you comfortable running Stage 1 entirely in the Q² sandbox with synthetic data (no touch on your systems)?", opts: ["Yes", "Prefer our environment", "Need to discuss"] },
      { id: "s9q3", t: "choice", q: "For a pilot, is a read-only shadow feed of in-scope movements feasible?", opts: ["Yes", "Maybe", "No", "Not sure"] },
      { id: "s9q4", t: "short", q: "Vendor security review process for a new tool, and typical duration." },
      { id: "s9q6", t: "para", q: "Artifacts, at whatever fidelity your policy allows: a high-level architecture diagram (redacted or whiteboard-level is fine), your approval / policy matrix, one recent audit-evidence example, and one administrator or LP report. Note here what you can share and we will arrange a secure channel." },
      { id: "s9q7", t: "para", q: "Your change and release process for new integrations, plus any freeze windows in the next four months." },
    ],
  },
  {
    n: 10,
    title: "Priorities, success & logistics",
    why: "Your priorities set what we build first, and your success definition becomes the program's gates.",
    qs: [
      { id: "s10q1", t: "choice", q: "Which flow would you most want governed and evidenced first?", opts: ["LP redemptions / distributions", "LP subscriptions", "Opportunistic-sleeve on-chain deployment", "Sleeve rebalancing", "Other"] },
      { id: "s10q2", t: "para", q: "In one or two sentences: what would make the Sandbox clearly worth it, and what must a Pilot demonstrate for you to advocate internally?" },
      { id: "s10q3", t: "short", q: "Program roles (names / titles): executive sponsor · program champion · technical counterpart · compliance contact." },
      { id: "s10q4", t: "short", q: "Working days, time zone (as your site describes, US Eastern / Miami — please correct us if that's out of date), and preferred meeting cadence & channel." },
      { id: "s10q6", t: "para", q: "Your top three strategic initiatives over the next 12–24 months, and which of them will increase the volume, value, or complexity of movements — or add a new regulator or jurisdiction to your obligations." },
      { id: "s10q7", t: "para", q: "In one sentence: what would your leadership most want this program to have achieved twelve months from now?" },
      { id: "s10q8", t: "short", q: "Realistic timeline expectations: Discovery → Sandbox start · Sandbox → Pilot decision · Pilot → Production decision." },
      { id: "s10q9", t: "para", q: "Beyond the initial scope, what would you expect from Q² over time — and how do you see the partnership growing (more entities, more workflows, more jurisdictions)?" },
      { id: "s10q5", t: "para", q: "Anything else about how the Fund operates, or constraints we should know, that these questions did not reach?" },
    ],
  },
];

const ALL_QS = SECTIONS.flatMap(s => s.qs);

// ─── Answer helpers ────────────────────────────────────────────────
const isAnswered = (q, v) => {
  if (v == null) return false;
  if (q.t === "checks") return Array.isArray(v?.picked) && (v.picked.length > 0 || !!v.other?.trim());
  return String(v).trim().length > 0;
};
const answerToText = (q, v) => {
  if (!isAnswered(q, v)) return "—";
  if (q.t === "checks") {
    const picked = [...(v.picked || [])];
    if (v.other?.trim()) picked.push(`Other: ${v.other.trim()}`);
    return picked.join("; ");
  }
  return String(v).trim();
};

// ─── PDF (jsPDF loaded on demand so it never touches the main bundle) ─
async function buildPdf(answers, meta) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  const MAXW = W - M * 2;
  let y = M;

  const nl = (h) => { if (y + h > H - M) { doc.addPage(); y = M; } };
  const write = (text, { size = 10, style = "normal", color = [26, 20, 48], gap = 4, indent = 0 } = {}) => {
    doc.setFont("helvetica", style); doc.setFontSize(size); doc.setTextColor(...color);
    const lines = doc.splitTextToSize(String(text), MAXW - indent);
    lines.forEach(ln => { nl(size + 4); doc.text(ln, M + indent, y); y += size + 3; });
    y += gap;
  };

  // Cover
  doc.setFillColor(124, 58, 237); doc.rect(0, 0, W, 118, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(19);
  doc.text("Quantum Qustody", M, 52);
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  doc.text("Design Partner Discovery — completed intake", M, 74);
  doc.setFontSize(9);
  doc.text(meta.title, M, 96, { maxWidth: MAXW });
  y = 150;

  write("Submission details", { size: 13, style: "bold", color: [124, 58, 237], gap: 6 });
  write(`Partner: ${meta.partner}`, { size: 10 });
  write(`Respondent: ${meta.respondent}`, { size: 10 });
  write(`Submitted: ${meta.submittedAt}`, { size: 10 });
  write(`Completed: ${meta.answered} of ${meta.total} questions`, { size: 10 });
  write(`Confidentiality accepted: ${meta.consentAt}`, { size: 10, gap: 12 });

  SECTIONS.forEach(sec => {
    nl(60);
    y += 6;
    doc.setDrawColor(217, 210, 236); doc.setLineWidth(0.6);
    doc.line(M, y - 8, W - M, y - 8);
    write(`Section ${sec.n} — ${sec.title}`, { size: 13, style: "bold", color: [124, 58, 237], gap: 2 });
    write(sec.why, { size: 8.5, style: "italic", color: [110, 100, 135], gap: 8 });
    sec.qs.forEach((q, i) => {
      write(`${sec.n}.${i + 1}  ${q.q}`, { size: 9.5, style: "bold", gap: 2 });
      write(answerToText(q, answers[q.id]), { size: 10, color: [50, 44, 75], gap: 10, indent: 12 });
    });
  });

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(140, 132, 160);
    doc.text("Confidential — Q² × Chayne engagement only · info@quantumqustody.com", M, H - 22);
    doc.text(`${p} / ${pages}`, W - M, H - 22, { align: "right" });
  }
  return doc;
}

// ─── Gate ──────────────────────────────────────────────────────────
function Gate({ onIn }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e?.preventDefault();
    setErr(null); setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
      if (error) throw error;
      // Gate on app_metadata, NOT user_metadata: user_metadata is writable by
      // the account holder at sign-up (the anon key is public), so gating on it
      // would let anyone self-grant access. app_metadata is service-role only.
      if (data?.user?.app_metadata?.role !== "design_partner") {
        await supabase.auth.signOut();
        throw new Error("This account does not have Design Partner access.");
      }
      onIn(data.user);
    } catch (e2) {
      setErr(e2?.message || "Sign-in failed.");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <form onSubmit={submit} className="glass w-full max-w-sm p-7 space-y-5" style={{ background: "rgba(10,5,25,.75)" }}>
        <div className="flex items-center gap-3">
          <img src="/qq-logo.svg" alt="QQ" className="w-8 h-8" />
          <div>
            <div className="font-bold text-sm tracking-tight">DESIGN PARTNER</div>
            <div className="fm text-[10px] text-gray-500">PRIVATE ACCESS</div>
          </div>
        </div>
        <p className="fm text-xs text-gray-400 leading-relaxed">
          This area is issued to named design partners. Use the credentials provided by Quantum Qustody.
        </p>
        <div className="space-y-3">
          <div>
            <label className="fm text-[10px] text-gray-500 mb-1.5 block">EMAIL</label>
            <input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@firm.com" required />
          </div>
          <div>
            <label className="fm text-[10px] text-gray-500 mb-1.5 block">PASSWORD</label>
            <input type="password" autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••••••" required />
          </div>
        </div>
        {err && <div className="p-3 bg-red-500/10 border border-red-500/30 fm text-xs text-red-300">{err}</div>}
        <button type="submit" disabled={busy}
          className="w-full fm text-xs px-4 py-3 border border-purple-500/50 bg-purple-500/15 text-purple-200 hover:bg-purple-500/25 transition-all cursor-pointer disabled:opacity-40">
          {busy ? "VERIFYING…" : "ENTER"}
        </button>
        <div className="fm text-[9px] text-gray-600 leading-snug">
          Access is logged. Contact info@quantumqustody.com if you need credentials reissued.
        </div>
      </form>
    </div>
  );
}

// ─── Question renderer ─────────────────────────────────────────────
function Question({ q, idx, secN, value, onChange }) {
  const answered = isAnswered(q, value);
  const setChecks = (opt) => {
    const cur = value?.picked || [];
    const picked = cur.includes(opt) ? cur.filter(x => x !== opt) : [...cur, opt];
    onChange({ ...(value || {}), picked });
  };
  return (
    <div className="py-5 border-b border-purple-500/10 last:border-b-0">
      <div className="flex items-start gap-3 mb-3">
        <span className={`fm text-[10px] mt-0.5 flex-shrink-0 w-8 ${answered ? "text-emerald-400" : "text-gray-600"}`}>
          {secN}.{idx + 1}
        </span>
        <div className="flex-1 min-w-0">
          <label className="text-sm text-gray-200 leading-relaxed block">
            {q.q}{q.req && <span className="text-fuchsia-400 ml-1">*</span>}
          </label>
        </div>
        {answered && <span className="text-emerald-400 text-xs flex-shrink-0">✓</span>}
      </div>
      <div className="pl-11">
        {q.t === "short" && (
          <input value={value || ""} onChange={e => onChange(e.target.value)} placeholder="Your answer" />
        )}
        {q.t === "para" && (
          <textarea rows={4} value={value || ""} onChange={e => onChange(e.target.value)} placeholder="Your answer" style={{ resize: "vertical", lineHeight: 1.6 }} />
        )}
        {q.t === "choice" && (
          <div className="flex flex-wrap gap-2">
            {q.opts.map(o => (
              <button key={o} type="button" onClick={() => onChange(value === o ? "" : o)}
                className={`fm text-xs px-3 py-2 border transition-all cursor-pointer ${value === o
                  ? "border-purple-500 bg-purple-500/20 text-purple-200"
                  : "border-gray-800 bg-black/30 text-gray-400 hover:border-gray-700"}`}>
                {o}
              </button>
            ))}
          </div>
        )}
        {q.t === "checks" && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {q.opts.map(o => {
                const on = (value?.picked || []).includes(o);
                return (
                  <button key={o} type="button" onClick={() => setChecks(o)}
                    className={`fm text-xs px-3 py-2 border transition-all cursor-pointer flex items-center gap-2 ${on
                      ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                      : "border-gray-800 bg-black/30 text-gray-400 hover:border-gray-700"}`}>
                    <span className={`w-3 h-3 border flex items-center justify-center text-[8px] ${on ? "border-emerald-400 bg-emerald-400 text-black" : "border-gray-600"}`}>{on ? "✓" : ""}</span>
                    {o}
                  </button>
                );
              })}
            </div>
            {q.other && (
              <input value={value?.other || ""} onChange={e => onChange({ ...(value || {}), other: e.target.value })}
                placeholder="Other — please specify" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────
export default function DesignPartnerPage({ onBack, onSandbox }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [consent, setConsent] = useState(null);     // ISO timestamp once accepted
  const [step, setStep] = useState(0);              // 0..9 sections, 10 = review
  const [answers, setAnswers] = useState({});
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);       // {ok, emailed, stored, msg}
  const topRef = useRef(null);

  // Restore an existing session (so a refresh mid-intake doesn't lock you out)
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const u = data?.session?.user;
      if (u && u.app_metadata?.role === "design_partner") setUser(u);
      setChecking(false);
    }).catch(() => alive && setChecking(false));
    return () => { alive = false; };
  }, []);

  // Restore draft + prior consent
  useEffect(() => {
    try { const raw = localStorage.getItem(DRAFT_KEY); if (raw) setAnswers(JSON.parse(raw)); } catch {}
    try { const c = localStorage.getItem(CONSENT_KEY); if (c) setConsent(c); } catch {}
  }, []);

  // Autosave draft
  useEffect(() => {
    if (!Object.keys(answers).length) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(answers)); setSaved(true); } catch {}
    const t = setTimeout(() => setSaved(false), 1600);
    return () => clearTimeout(t);
  }, [answers]);

  useEffect(() => { topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [step]);

  const answeredCount = useMemo(() => ALL_QS.filter(q => isAnswered(q, answers[q.id])).length, [answers]);
  const pct = Math.round((answeredCount / ALL_QS.length) * 100);
  const secDone = (sec) => sec.qs.filter(q => isAnswered(q, answers[q.id])).length;
  const missingRequired = ALL_QS.filter(q => q.req && !isAnswered(q, answers[q.id]));

  const set = (id, v) => setAnswers(a => ({ ...a, [id]: v }));

  const submit = async () => {
    setSubmitting(true); setResult(null);
    const submittedAt = new Date().toISOString();
    const meta = {
      title: FORM_TITLE, partner: PARTNER.name, respondent: user?.email || "unknown",
      submittedAt: new Date(submittedAt).toLocaleString(), answered: answeredCount, total: ALL_QS.length,
      consentAt: consent ? new Date(consent).toLocaleString() : "not recorded",
    };
    const flat = SECTIONS.map(sec => ({
      section: `Section ${sec.n} — ${sec.title}`,
      items: sec.qs.map(q => ({ id: q.id, question: q.q, answer: answerToText(q, answers[q.id]) })),
    }));

    let pdfB64 = null, doc = null;
    try {
      doc = await buildPdf(answers, meta);
      pdfB64 = doc.output("datauristring").split(",")[1];
    } catch (e) { /* PDF optional — never block the submission */ }

    let emailed = false, stored = false, msg = "";
    try {
      const { data, error } = await supabase.functions.invoke("design-partner-submit", {
        body: {
          partner: PARTNER.id, partner_name: PARTNER.name, respondent: user?.email,
          submitted_at: submittedAt, answered: answeredCount, total: ALL_QS.length,
          consent_accepted_at: consent,
          answers, sections: flat, pdf_base64: pdfB64,
          filename: `QQ-Chayne-Discovery-${submittedAt.slice(0, 10)}.pdf`,
        },
      });
      if (error) throw error;
      emailed = !!data?.emailed; stored = !!data?.stored;
      if (!emailed) msg = data?.email_error || "Stored. Email delivery is not configured yet.";
    } catch (e) {
      msg = "Delivery service unavailable — your answers were saved locally and the PDF has been downloaded.";
      // Best-effort direct insert so nothing is lost
      try {
        const { error } = await supabase.from("design_partner_responses").insert({
          partner: PARTNER.id, respondent_email: user?.email, answers,
          answered_count: answeredCount, total_questions: ALL_QS.length,
        });
        if (!error) stored = true;
      } catch {}
    }

    // The partner always walks away with the document
    try { doc?.save(`QQ-Chayne-Discovery-${submittedAt.slice(0, 10)}.pdf`); } catch {}

    setResult({ ok: true, emailed, stored, msg });
    setSubmitting(false);
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
  };

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center"><div className="fm text-xs text-gray-500">CHECKING ACCESS…</div></div>;
  }
  if (!user) {
    return (
      <div className="min-h-screen">
        <TopBar onBack={onBack} />
        <Gate onIn={setUser} />
      </div>
    );
  }

  // ── Confidentiality consent — must be accepted before the questionnaire ──
  if (!consent && !result) {
    const accept = () => {
      const ts = new Date().toISOString();
      try { localStorage.setItem(CONSENT_KEY, ts); } catch {}
      setConsent(ts);
    };
    return (
      <div className="min-h-screen">
        <TopBar onBack={onBack} user={user} onOut={async () => { await supabase.auth.signOut(); setUser(null); }} />
        <div className="max-w-2xl mx-auto px-4 pt-28 pb-20">
          <div className="glass p-6 md:p-8 space-y-5" style={{ background: "rgba(10,5,25,.7)" }}>
            <div>
              <div className="fm text-[10px] text-fuchsia-500 tracking-widest mb-2">[ BEFORE YOU BEGIN ]</div>
              <h1 className="text-2xl font-bold mb-1">Confidentiality</h1>
              <p className="fm text-xs text-gray-500">{FORM_TITLE}</p>
            </div>
            <div className="p-4 border border-purple-500/20 bg-purple-500/5 space-y-3 max-h-[42vh] overflow-y-auto">
              {CONFIDENTIALITY.split("\n\n").map((p, i) => (
                <p key={i} className="text-[13px] text-gray-300 leading-relaxed">{p}</p>
              ))}
            </div>
            <button onClick={accept} type="button"
              className="w-full flex items-start gap-3 p-4 border border-gray-800 bg-black/30 hover:border-purple-500/50 transition-all cursor-pointer text-left">
              <span className="w-4 h-4 mt-0.5 border border-gray-600 flex-shrink-0" />
              <span className="text-[13px] text-gray-300 leading-relaxed">
                I have read and agree to the confidentiality terms above, and I am authorised to provide this information on behalf of {PARTNER.name}.
              </span>
            </button>
            <div className="fm text-[10px] text-gray-600 leading-snug">
              Ticking the box records your acceptance with a timestamp and continues to the questionnaire.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Submitted ──
  if (result) {
    return (
      <div className="min-h-screen">
        <TopBar onBack={onBack} />
        <div className="max-w-2xl mx-auto px-4 pt-28 pb-20">
          <div className="glass p-8 text-center space-y-4" style={{ background: "rgba(10,5,25,.7)" }}>
            <div className="inline-flex w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 items-center justify-center text-emerald-400 text-2xl">✓</div>
            <h2 className="text-2xl font-bold">Discovery submitted</h2>
            <p className="fm text-sm text-gray-400 leading-relaxed">
              Thank you — {answeredCount} of {ALL_QS.length} questions captured. A PDF copy has been downloaded for your records.
            </p>
            <div className="space-y-2 pt-2 text-left">
              <Row label="Stored securely" ok={result.stored} />
              <Row label="Delivered to Quantum Qustody" ok={result.emailed} />
            </div>
            {result.msg && <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 fm text-xs text-yellow-200 text-left">{result.msg}</div>}
            <button onClick={onBack} className="fm text-xs px-4 py-2.5 border border-purple-500/40 text-purple-300 hover:bg-purple-500/10 transition-all cursor-pointer">
              RETURN TO SITE
            </button>
          </div>

          {/* Next step — take the sandbox for a drive */}
          <div className="glass mt-5 p-7 md:p-8 relative overflow-hidden" style={{ background: "rgba(10,5,25,.7)", borderTop: "2px solid rgba(217,70,239,.5)" }}>
            <div className="absolute -right-16 -top-16 w-52 h-52 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(217,70,239,.16), transparent 70%)" }} />
            <div className="relative">
              <div className="fm text-[10px] text-fuchsia-500 tracking-widest mb-3">[ NEXT STEP ]</div>
              <h3 className="text-xl md:text-2xl font-bold mb-3 leading-tight">Ready to try the sandbox?</h3>
              <p className="fm text-sm text-gray-400 leading-relaxed mb-5">
                Your discovery is with us. While we prepare your session, take the platform for a drive — create an account and run a governed movement end to end on the Ethereum Sepolia testnet. It runs entirely on test assets, so nothing you do there touches production.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-6">
                {[
                  { k: "01", t: "Create your account", d: "Email + password, under a minute." },
                  { k: "02", t: "Connect a test wallet", d: "MetaMask or Coinbase on Sepolia." },
                  { k: "03", t: "Move under policy", d: "Send, swap, and see the evidence." },
                ].map(s => (
                  <div key={s.k} className="p-3 border border-gray-800 bg-black/30">
                    <div className="fm text-[10px] text-fuchsia-400 mb-1">{s.k}</div>
                    <div className="text-xs font-bold text-gray-200 mb-0.5">{s.t}</div>
                    <div className="fm text-[10px] text-gray-500 leading-snug">{s.d}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => (onSandbox ? onSandbox() : window.location.assign(SANDBOX_URL))}
                  className="bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white px-6 py-3.5 fm text-sm font-bold hover:from-purple-500 hover:to-fuchsia-500 transition-colors glow cursor-pointer">
                  CREATE SANDBOX ACCOUNT →
                </button>
                <button onClick={onBack}
                  className="fm text-sm px-6 py-3.5 border border-gray-700 text-gray-400 hover:bg-white/5 transition-all cursor-pointer">
                  MAYBE LATER
                </button>
              </div>
              <div className="fm text-[10px] text-gray-600 mt-4 leading-snug">
                Testnet only — no real assets, no custody, no signing authority. Q² never holds your keys.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const onReview = step === SECTIONS.length;
  const sec = SECTIONS[step];

  return (
    <div className="min-h-screen">
      <TopBar onBack={onBack} user={user} onOut={async () => { await supabase.auth.signOut(); setUser(null); }} />
      <div ref={topRef} />

      {/* Header */}
      <div className="max-w-6xl mx-auto px-4 pt-24 pb-6">
        <div className="fm text-[10px] text-fuchsia-500 tracking-widest mb-2">[ DESIGN PARTNER DISCOVERY ]</div>
        <h1 className="text-2xl md:text-3xl font-bold mb-2 leading-tight">{FORM_TITLE}</h1>
        <p className="fm text-xs text-gray-500 mb-4">{PARTNER.fund} · confidential</p>
        {/* Reassurance — directly under the title, above the progress bar */}
        <div className="p-4 border border-emerald-500/25 bg-emerald-500/[.06]">
          <p className="text-[13px] text-gray-300 leading-relaxed">{REASSURANCE}</p>
          <p className="text-[13px] text-emerald-300 leading-relaxed mt-2">{REASSURANCE_SHORT}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="max-w-6xl mx-auto px-4 pb-6">
        <div className="glass p-4" style={{ background: "rgba(10,5,25,.6)" }}>
          <div className="flex items-center justify-between fm text-[10px] text-gray-500 mb-2">
            <span>{answeredCount} of {ALL_QS.length} answered</span>
            <span className={saved ? "text-emerald-400" : "text-gray-600"}>{saved ? "DRAFT SAVED" : "AUTOSAVE ON"}</span>
          </div>
          <div className="h-1.5 bg-black/50 overflow-hidden">
            <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: "linear-gradient(to right,#a855f7,#e879f9)" }} />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-24 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        {/* Section rail */}
        <nav className="hidden lg:block">
          <div className="sticky top-24 space-y-1">
            {SECTIONS.map((s, i) => {
              const done = secDone(s), tot = s.qs.length, active = i === step;
              return (
                <button key={s.n} onClick={() => setStep(i)}
                  className={`w-full text-left px-3 py-2.5 border-l-2 transition-all cursor-pointer ${active
                    ? "border-purple-500 bg-purple-500/10" : "border-transparent hover:bg-white/[.03]"}`}>
                  <div className={`fm text-[10px] mb-0.5 ${done === tot ? "text-emerald-400" : active ? "text-purple-300" : "text-gray-600"}`}>
                    {done === tot ? "✓" : `${done}/${tot}`} · SECTION {s.n}
                  </div>
                  <div className={`text-xs leading-snug ${active ? "text-gray-200" : "text-gray-500"}`}>{s.title}</div>
                </button>
              );
            })}
            <button onClick={() => setStep(SECTIONS.length)}
              className={`w-full text-left px-3 py-2.5 border-l-2 transition-all cursor-pointer ${onReview
                ? "border-fuchsia-500 bg-fuchsia-500/10" : "border-transparent hover:bg-white/[.03]"}`}>
              <div className="fm text-[10px] text-fuchsia-400 mb-0.5">FINAL</div>
              <div className={`text-xs ${onReview ? "text-gray-200" : "text-gray-500"}`}>Review & submit</div>
            </button>
          </div>
        </nav>

        {/* Panel */}
        <div>
          {!onReview && (
            <div className="glass p-6 md:p-8" style={{ background: "rgba(10,5,25,.6)" }}>
              <div className="mb-5 pb-5 border-b border-purple-500/15">
                <div className="fm text-[10px] text-purple-400 tracking-widest mb-1.5">SECTION {sec.n} OF {SECTIONS.length}</div>
                <h2 className="text-xl font-bold mb-2">{sec.title}</h2>
                <p className="fm text-xs text-gray-500 leading-relaxed">{sec.why}</p>
              </div>
              {sec.qs.map((q, i) => (
                <Question key={q.id} q={q} idx={i} secN={sec.n} value={answers[q.id]} onChange={v => set(q.id, v)} />
              ))}
              <div className="flex items-center justify-between gap-3 pt-6 mt-2 border-t border-purple-500/15">
                <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
                  className="fm text-xs px-4 py-2.5 border border-gray-700 text-gray-400 hover:bg-white/5 transition-all cursor-pointer disabled:opacity-30">
                  ← BACK
                </button>
                <span className="fm text-[10px] text-gray-600">{secDone(sec)} / {sec.qs.length} in this section</span>
                <button onClick={() => setStep(s => s + 1)}
                  className="fm text-xs px-4 py-2.5 border border-purple-500/50 bg-purple-500/15 text-purple-200 hover:bg-purple-500/25 transition-all cursor-pointer">
                  {step === SECTIONS.length - 1 ? "REVIEW →" : "NEXT →"}
                </button>
              </div>
            </div>
          )}

          {onReview && (
            <div className="space-y-4">
              <div className="glass p-6 md:p-8" style={{ background: "rgba(10,5,25,.6)" }}>
                <div className="fm text-[10px] text-fuchsia-400 tracking-widest mb-1.5">FINAL</div>
                <h2 className="text-xl font-bold mb-2">Review & submit</h2>
                <p className="fm text-xs text-gray-500 leading-relaxed mb-5">
                  {answeredCount} of {ALL_QS.length} answered. Blank answers are fine — submit at whatever fidelity your security policy allows. On submit we store your responses and send a PDF of this intake to Quantum Qustody; a copy downloads to your device.
                </p>
                {missingRequired.length > 0 && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 fm text-xs text-yellow-200 mb-5">
                    {missingRequired.length} required question{missingRequired.length > 1 ? "s" : ""} still blank — you can still submit, but these help us route follow-ups.
                  </div>
                )}
                <div className="space-y-5 max-h-[46vh] overflow-y-auto pr-2">
                  {SECTIONS.map(s => (
                    <div key={s.n}>
                      <div className="fm text-[10px] text-purple-400 mb-2 sticky top-0 py-1" style={{ background: "rgba(10,5,25,.95)" }}>
                        SECTION {s.n} — {s.title.toUpperCase()}
                      </div>
                      {s.qs.map((q, i) => (
                        <div key={q.id} className="mb-3 pl-3 border-l border-purple-500/20">
                          <div className="fm text-[10px] text-gray-500 mb-0.5">{s.n}.{i + 1}</div>
                          <div className="text-xs text-gray-400 leading-snug mb-1">{q.q}</div>
                          <div className={`text-xs leading-relaxed ${isAnswered(q, answers[q.id]) ? "text-gray-200" : "text-gray-700 italic"}`}>
                            {answerToText(q, answers[q.id])}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-3 pt-6 mt-4 border-t border-purple-500/15">
                  <button onClick={() => setStep(SECTIONS.length - 1)}
                    className="fm text-xs px-4 py-2.5 border border-gray-700 text-gray-400 hover:bg-white/5 transition-all cursor-pointer">
                    ← BACK
                  </button>
                  <button onClick={submit} disabled={submitting}
                    className="fm text-xs px-6 py-2.5 border border-fuchsia-500/50 bg-fuchsia-500/15 text-fuchsia-200 hover:bg-fuchsia-500/25 transition-all cursor-pointer disabled:opacity-40">
                    {submitting ? "SUBMITTING…" : "SUBMIT DISCOVERY"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Mobile stepper */}
          <div className="lg:hidden mt-4 flex flex-wrap gap-1.5">
            {SECTIONS.map((s, i) => {
              const done = secDone(s) === s.qs.length;
              return (
                <button key={s.n} onClick={() => setStep(i)}
                  className={`fm text-[10px] w-8 h-8 border transition-all cursor-pointer ${i === step
                    ? "border-purple-500 bg-purple-500/20 text-purple-200"
                    : done ? "border-emerald-500/40 text-emerald-400" : "border-gray-800 text-gray-600"}`}>
                  {s.n}
                </button>
              );
            })}
            <button onClick={() => setStep(SECTIONS.length)}
              className={`fm text-[10px] px-3 h-8 border transition-all cursor-pointer ${onReview
                ? "border-fuchsia-500 bg-fuchsia-500/20 text-fuchsia-200" : "border-gray-800 text-gray-600"}`}>
              REVIEW
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, ok }) {
  return (
    <div className="flex items-center justify-between p-3 bg-black/30 border border-gray-800/60 fm text-xs">
      <span className="text-gray-400">{label}</span>
      <span className={ok ? "text-emerald-400" : "text-yellow-300"}>{ok ? "✓ DONE" : "PENDING"}</span>
    </div>
  );
}

function TopBar({ onBack, user, onOut }) {
  return (
    <div className="fixed top-0 w-full z-50 p-4">
      <div className="max-w-6xl mx-auto glass rounded-sm flex justify-between items-center px-5 py-3" style={{ background: "rgba(5,2,15,.85)" }}>
        <button onClick={onBack} className="fm text-xs text-gray-300 hover:text-purple-400 transition-colors cursor-pointer">← BACK TO SITE</button>
        <div className="flex items-center gap-3">
          {user && (
            <>
              <span className="hidden sm:inline fm text-[10px] text-gray-500 truncate max-w-[180px]">{user.email}</span>
              <button onClick={onOut} className="fm text-[10px] text-gray-500 hover:text-red-300 transition-colors cursor-pointer">SIGN OUT</button>
            </>
          )}
          <div className="flex items-center gap-2">
            <img src="/qq-logo.svg" alt="QQ" className="w-6 h-6" />
            <span className="font-bold text-sm tracking-tight hidden sm:inline">QUANTUM_QUSTODY</span>
          </div>
        </div>
      </div>
    </div>
  );
}
