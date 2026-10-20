import { useEffect, useRef, useState } from "react";
import SignedRecord from "./SignedRecord.jsx";
import Atom3D from "./Atom3D.jsx";
import { initMotion, spotlight } from "./motion.js";
import { FIGURES } from "./Figures.jsx";
import { RULES } from "./rules.js";

const Arrow = () => (
  <svg className="arrow" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

// Same public endpoint the Design Partner intake already uses: it stores the
// row in design_partner_responses and emails the team. Plain fetch, so the
// public site does not load the Supabase client.
async function sendEnquiry(f) {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Form is not configured.");
  const items = [
    ["Name", f.name], ["Work email", f.email], ["Organisation", f.org],
    ["Role", f.role || "-"], ["Which movements would you like evidenced first?", f.message],
  ].map(([question, answer]) => ({ question, answer }));
  const res = await fetch(`${url}/functions/v1/design-partner-submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      partner: "inbound",
      partner_name: `Inbound enquiry: ${f.org}`,
      respondent: f.email,
      submitted_at: new Date().toISOString(),
      consent_accepted_at: new Date().toISOString(),
      answered: items.filter((i) => i.answer && i.answer !== "-").length,
      total: items.length,
      answers: { name: f.name, email: f.email, org: f.org, role: f.role, message: f.message, source: "website" },
      sections: [{ section: "Design partner enquiry (website)", items }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.stored) throw new Error(data?.store_error || data?.error || `Request failed (${res.status})`);
  return data;
}

function EnquiryForm({ onPartnerSignIn }) {
  const [f, setF] = useState({ name: "", email: "", org: "", role: "", message: "", consent: false });
  const [errors, setErrors] = useState({});
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [msg, setMsg] = useState("");
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const validate = () => {
    const e = {};
    if (!f.name.trim()) e.name = "Enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = "Enter a valid work email.";
    if (!f.org.trim()) e.org = "Enter your organisation.";
    if (!f.message.trim()) e.message = "Tell us one flow you would like evidenced.";
    if (!f.consent) e.consent = "Please confirm we may contact you.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setState("sending");
    try {
      await sendEnquiry({ ...f, name: f.name.trim(), email: f.email.trim(), org: f.org.trim(), message: f.message.trim() });
      setState("sent");
    } catch (err) {
      setMsg(err.message);
      setState("error");
    }
  };

  if (state === "sent") {
    return (
      <div className="form" role="status">
        <h3>Thank you. We have your enquiry.</h3>
        <p style={{ color: "var(--q-ink-2)" }}>We will reply to {f.email}.</p>
      </div>
    );
  }

  const field = (k, label, props = {}, optional = false) => (
    <div className="field">
      <label htmlFor={`dp-${k}`}>{label}{optional && <span className="opt"> (optional)</span>}</label>
      <input id={`dp-${k}`} value={f[k]} onChange={set(k)} aria-invalid={!!errors[k]} aria-describedby={errors[k] ? `dp-${k}-err` : undefined} {...props} />
      {errors[k] && <span id={`dp-${k}-err`} className="field__err">{errors[k]}</span>}
    </div>
  );

  return (
    <form className="form" onSubmit={submit} noValidate aria-labelledby="dp-form-title">
      <h3 id="dp-form-title">Book a 30-minute diagnostic call</h3>
      <div className="form__row">
        {field("name", "Name", { autoComplete: "name" })}
        {field("email", "Work email", { type: "email", autoComplete: "email", inputMode: "email" })}
      </div>
      <div className="form__row">
        {field("org", "Organisation", { autoComplete: "organization" })}
        {field("role", "Role", { autoComplete: "organization-title" }, true)}
      </div>
      <div className="field">
        <label htmlFor="dp-message">Which movements would you like evidenced first?</label>
        <textarea id="dp-message" value={f.message} onChange={set("message")} aria-invalid={!!errors.message} aria-describedby={errors.message ? "dp-message-err" : undefined} placeholder="For example: approvals for transfers from our fund’s MPC wallets to two custodians." />
        {errors.message && <span id="dp-message-err" className="field__err">{errors.message}</span>}
      </div>
      <div>
        <label className="check">
          <input type="checkbox" checked={f.consent} onChange={set("consent")} aria-invalid={!!errors.consent} />
          <span>Q Squared may use these details to contact me about the design partner programme. Do not include credentials, keys or client data.</span>
        </label>
        {errors.consent && <span className="field__err">{errors.consent}</span>}
      </div>
      {state === "error" && (
        <div className="form__status form__status--err" role="alert">
          We could not send this ({msg}). Please try again, or write to <a href="mailto:info@quantumqustody.com">info@quantumqustody.com</a>.
        </div>
      )}
      <div className="form__foot">
        <button className="btn btn--primary" type="submit" disabled={state === "sending"}>
          {state === "sending" ? "Sending" : "Send enquiry"} {state !== "sending" && <Arrow />}
        </button>
        <small>
          Already a design partner? <a href="/design-partner" onClick={onPartnerSignIn}>Sign in to your intake</a>
        </small>
      </div>
    </form>
  );
}

// ── Landing ────────────────────────────────────────────────────────────────
// Order follows the website review of 13 Oct 2026: hero, why now, who it is
// for, how it works, where Q² sits, capabilities, regulation, start.
// Figures are hand-written SVG (Figures.jsx). Status labels follow the claims
// rule: everything is labelled Sandbox, In design or Roadmap. Nothing is live.

export const Pill = ({ children, href, onClick, variant = "primary" }) => (
  <a className={`pill pill--${variant}`} href={href} onClick={onClick}>
    <span>{children}</span>
    <span className="pill__ico" aria-hidden="true"><Arrow /></span>
  </a>
);

export const STATUS = {
  sandbox: { label: "Sandbox", title: "Try it today on testnet" },
  design: { label: "In design", title: "Specified and being built with design partners" },
  roadmap: { label: "Roadmap", title: "Planned" },
};
export const Status = ({ s }) => <span className={`status status--${s}`} title={STATUS[s].title}>{STATUS[s].label}</span>;

const STEPS = [
  {
    id: "step-approve", n: "01", title: "Approve", object: "quorum", status: "sandbox",
    head: "A quorum before any key signs.",
    body: "A quorum of people, or a policy they signed, approves each movement before your own key signs. Agents can propose; they never approve or sign.",
    spec: [["Proposes", "A person, a system or an agent"], ["Decides", "A quorum, or a policy they signed"], ["Signs", "Your own signer, after the decision"]],
  },
  {
    id: "step-record", n: "02", title: "Record", object: "record", status: "sandbox",
    head: "One authority record per movement.",
    body: "Who proposed, who approved, under which mandate and policy version, matched to what executed.",
    spec: [["Contains", "Proposer, approvers, mandate, policy version"], ["Matched to", "What executed. Refusals with their reason are in design"], ["Integrity", "Hash-chained, so tampering is detectable"]],
  },
  {
    id: "step-seal", n: "03", title: "Seal", object: "seal", status: "design",
    head: "Sealed to outlast the algorithm.",
    body: "Each record carries hybrid classical and post-quantum signatures (NIST FIPS 204), and is re-sealed as algorithms retire.",
    spec: [["Seal", "Hybrid classical and post-quantum (FIPS 204)"], ["Lifetime", "Re-sealed as algorithms retire"], ["Signal", "US federal systems must move to post-quantum signatures by 2031 (EO 14412)"]],
  },
  {
    id: "step-disclose", n: "04", title: "Disclose", object: "disclose", status: "design",
    head: "Show the proof, not the positions.",
    body: "Prove a fact to an auditor, investor or supervisor, for example that every movement last quarter had two approvals, without handing over positions or counterparties.",
    spec: [["Reader", "Auditor, investor, supervisor or administrator"], ["Sees", "The statement, not the positions"], ["Method", "Zero-knowledge proofs"]],
  },
];

const BUYERS = [
  {
    name: "Fund managers",
    rows: [
      ["Who", "COO or CFO of a fund that holds digital assets, with a signer, an administrator and an auditor."],
      ["The problem", "Proof of who approved each movement is split across signer logs, administrator records, chat and email."],
      ["How they cope today", "Screenshots, spreadsheets and chat threads stitched together before each audit or due-diligence round."],
      ["Why switch", "One record across every provider. No change of custody, no keys handed over."],
      ["Success looks like", "Evidence for any movement in minutes, not hours. Audits and allocator questionnaires answered from one record."],
    ],
  },
  {
    name: "Custodians, CASPs and EMIs",
    rows: [
      ["Who", "Licensed firms whose supervisors ask how each movement was authorised."],
      ["The problem", "Records must be unalterable and show every instruction, including rejected ones (MiCA RTS 2025/1140)."],
      ["How they cope today", "Platform logs, each written by the vendor about itself."],
      ["Why switch", "Records a supervisor can read without your internal tools."],
      ["Success looks like", "A clean examination. Any movement explained on request."],
    ],
  },
  {
    name: "Teams running agents",
    rows: [
      ["Who", "Treasury, payments or trading teams letting agents move funds."],
      ["The problem", "Agent actions can be “difficult or impossible for humans” to undo (FSB)."],
      ["How they cope today", "Spend limits inside one wallet provider."],
      ["Why switch", "Agents propose; only people or a signed policy approve; every decision is on record."],
      ["Success looks like", "No agent can move funds without an approval on record."],
    ],
  },
];

// Capabilities: gapless 12-column bento, rows 5+7 / 4+8 / 7+5 / 6+6.
const CAPS = [
  { k: "approve", span: "c5", status: ["sandbox"], h: "Approve", p: "A quorum of people, or a policy they signed, approves each movement before your own key signs. Agents can propose; they never approve or sign.", f: "approve ⇔ Σ vᵢ ≥ k" },
  { k: "record", span: "c7", status: ["sandbox"], h: "Record", p: "One authority record per movement: who proposed, who approved, under which mandate and policy version, matched to what executed.", f: "hᵢ = H(hᵢ₋₁ ‖ rᵢ)" },
  { k: "refusals", span: "c4", status: ["design"], h: "Refusals on record", p: "Blocked and rejected movements are recorded with the reason, so you can prove what did not happen.", f: "r = (instruction, rejected, reason)" },
  { k: "disclose", span: "c8", status: ["design"], h: "Selective disclosure", p: "Prove a fact to an auditor, investor or supervisor, for example that every movement last quarter had two approvals, without handing over positions or counterparties. Zero-knowledge proofs.", f: "π ⊢ ∀m ∈ Q₃: approvals(m) ≥ 2" },
  { k: "controls", span: "c7", status: ["design"], h: "Programmable controls", p: "Smart accounts (ERC-4337) carry your rules on-chain: limits, time locks, allowlists, guardians. They work beside your existing signer.", f: "allow ⇔ amount ≤ L ∧ to ∈ W ∧ t ≥ t₀ + Δ" },
  { k: "seal", span: "c5", status: ["design"], h: "Crypto-agile seal", p: "Records are sealed with hybrid classical and post-quantum signatures and re-sealed as algorithms retire. Smart accounts can adopt post-quantum verification when chains support it. On-chain signatures remain classical until then.", f: "σ = (σ_classical, σ_FIPS204)" },
  { k: "evidence", span: "c6", status: ["sandbox"], h: "Evidence on demand", p: "An evidence pack for an auditor, administrator or supervisor, generated from the record. No reconciling.", f: "pack = export(records, period, reader)" },
  { k: "deploy", span: "c6", status: ["sandbox", "roadmap"], h: "Deploy where you need", p: "Cloud, run by Q², in the sandbox today. In-region and on-premise for regulated clients are on the roadmap; on-premise means Q² never sees your data.", f: "cloud · in-region · on-premise" },
];

function CodeSample() {
  return (
    <figure className="code shell" data-reveal>
      <div className="shell__core">
        <figcaption><span>propose-and-record.ts</span><span>Preview API, sandbox only. Interface may change.</span></figcaption>
        <pre tabIndex={0} aria-label="TypeScript example: submit a proposal, wait for a quorum decision, read the sealed record"><code>
<span className="k">import</span> {"{ Q2 }"} <span className="k">from</span> <span className="s">"@q2/sdk"</span>; <span className="c">// preview</span>{"\n\n"}
<span className="k">const</span> q2 = <span className="k">new</span> Q2({"{"} apiKey: process.env.Q2_SANDBOX_KEY {"}"});{"\n\n"}
<span className="c">// 1. A person, system or agent proposes. It cannot execute on its own.</span>{"\n"}
<span className="k">const</span> proposal = <span className="k">await</span> q2.proposals.create({"{"}{"\n"}
{"  "}actor: <span className="s">"agent:treasury-rebalancer-02"</span>,{"\n"}
{"  "}mandate: <span className="s">"MND-0417"</span>,{"\n"}
{"  "}action: {"{"} type: <span className="s">"transfer"</span>, asset: <span className="s">"USDC"</span>, amount: <span className="s">"120000"</span> {"}"},{"\n"}
{"}"});{"\n\n"}
<span className="c">// 2. People, or a policy they signed, decide.</span>{"\n"}
<span className="k">const</span> decision = <span className="k">await</span> q2.decisions.wait(proposal.id);{"\n\n"}
<span className="c">// 3. Your own signer executes. One record comes back.</span>{"\n"}
console.log(decision.record.id);   <span className="c">// "rec_7Q2KF9M4ZP"</span>{"\n"}
console.log(decision.record.seal); <span className="c">// "hybrid post-quantum (FIPS 204)"</span>
        </code></pre>
      </div>
    </figure>
  );
}

function Story() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const els = STEPS.map((s) => document.getElementById(s.id)).filter(Boolean);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActive(Number(e.target.dataset.i)); });
    }, { rootMargin: "-45% 0px -45% 0px" });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section className="story" id="how" aria-labelledby="how-title">
      <div className="wrap story__grid">
        <div className="story__pin">
          <h2 id="how-title" data-reveal>Approve. Record.<br />Seal. Disclose.</h2>
          <ol className="story__nav" aria-label="Steps">
            {STEPS.map((s, i) => (
              <li key={s.id} className={i === active ? "is-on" : i < active ? "is-done" : ""}>
                <a href={`#${s.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>
                  <span className="mono">{s.n}</span>{s.title}
                </a>
              </li>
            ))}
          </ol>
          <div className="story__stage" aria-hidden="true">
            {STEPS.map((s, i) => { const F = FIGURES[s.object]; return <F key={s.object} className={i === active ? "is-on" : ""} />; })}
          </div>
        </div>
        <div className="story__steps" id="story-steps">
          <span className="story__rail" aria-hidden="true"><span data-progress="story-steps" /></span>
          {STEPS.map((s, i) => (
            <article key={s.id} id={s.id} data-i={i} className="story__step" aria-labelledby={`${s.id}-h`}>
              <p className="story__n mono">{s.n} · {s.title} <Status s={s.status} /></p>
              <h3 id={`${s.id}-h`}>{s.head}</h3>
              <p className="story__body">{s.body}</p>
              <div className="story__inline" data-reveal>{(() => { const F = FIGURES[s.object]; return <F />; })()}</div>
              <dl className="spec">
                {s.spec.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
              </dl>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Landing({ go, enterPlatform }) {
  const root = useRef(null);
  const scrollTo = (id) => (e) => { e?.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const link = (path) => (e) => { e.preventDefault(); go(path); };

  useEffect(() => initMotion(root.current), []);

  return (
    <main id="main" ref={root} className="lp">
      {/* Hero: the claim, and the record itself as the visual */}
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__wash" aria-hidden="true" />
        <div className="wrap hero__grid">
          <div className="hero__in" data-hero>
            <h1 id="hero-title"><span>You hold the keys.</span> <span>Q² proves every decision made with them.</span></h1>
            <p className="hero__usp">
              One independent record of who approved each digital-asset movement, under which mandate and policy,
              across every custodian, signer and agent. Ready for your auditor on demand.
            </p>
            <div className="hero__ctas">
              <Pill href="#start" onClick={scrollTo("start")}>Book a 30-minute diagnostic call</Pill>
              <Pill href="#how" onClick={scrollTo("how")} variant="ghost">See how it works</Pill>
            </div>
          </div>
          <div className="hero__record" data-reveal data-reveal-delay="150"><SignedRecord /></div>
        </div>
      </section>

      {/* Why now: three cited facts */}
      <section className="proofs-band" id="why" aria-labelledby="why-title">
        <div className="wrap">
          <h2 id="why-title" className="sr-only">Why now</h2>
          <ul className="stats">
            <li className="stat shell" data-reveal>
              <div className="shell__core">
                <p className="stat__big"><span className="num" data-count="61">61</span><span className="num">%</span></p>
                <p className="stat__k">of institutional investors use several custodians.<sup className="fn">1</sup></p>
                <p className="stat__src"><sup>1</sup> EY, institutional investor digital assets survey, January 2026.</p>
              </div>
            </li>
            <li className="stat shell" data-reveal data-reveal-delay="100">
              <div className="shell__core">
                <p className="stat__big"><span className="num">at least </span><span className="num" data-count="2">2</span></p>
                <p className="stat__k">people must jointly authorise any crypto asset transaction, under the SEC's custody proposal.<sup className="fn">2</sup></p>
                <p className="stat__src"><sup>2</sup> SEC Release IA-7023, proposed Rule 223-1(b)(7)(ii), 1 Oct 2026. A proposal; comments close 7 Dec 2026.</p>
              </div>
            </li>
            <li className="stat shell" data-reveal data-reveal-delay="200">
              <div className="shell__core">
                <p className="stat__big stat__big--quote"><span className="num">“difficult or impossible”</span></p>
                <p className="stat__k">for humans to undo: how the FSB describes some agent actions.<sup className="fn">3</sup></p>
                <p className="stat__src"><sup>3</sup> Financial Stability Board, consultation on sound practices for AI, 10 June 2026.</p>
              </div>
            </li>
          </ul>
        </div>
      </section>

      {/* Who it is for */}
      <section className="section-x" id="who" aria-labelledby="who-title">
        <div className="wrap">
          <div className="head" data-reveal>
            <h2 id="who-title">Who it is for.</h2>
            <p>Funds first, because they carry the evidence burden today. Agents are why the record keeps growing.</p>
          </div>
          <div className="buyers">
            {BUYERS.map((b, i) => (
              <article key={b.name} className="buyer shell" data-reveal data-reveal-delay={i * 90} onPointerMove={spotlight} aria-labelledby={`buyer-${i}`}>
                <div className="shell__core">
                  <h3 id={`buyer-${i}`}>{b.name}</h3>
                  <dl>{b.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <Story />

      {/* Where Q² sits: the whole fund stack */}
      <section className="section-x" id="where" aria-labelledby="where-title">
        <div className="wrap">
          <div className="head" data-reveal>
            <h2 id="where-title">Where Q² sits.</h2>
            <p>Between whoever proposes a movement and the stack that executes it, with the people who must read the record at the side. Q² never touches the money.</p>
          </div>
          <figure className="diagram" aria-labelledby="diagram-cap" style={{ margin: 0 }} data-reveal>
            <div className="diagram__stack">
              <div className="tier">
                <div className="tier__label"><span>Proposers</span><span>examples</span></div>
                <ul className="chips"><li className="chip">Portfolio managers</li><li className="chip">Treasury systems</li><li className="chip">AI agents (x402, AP2, Visa TAP)</li></ul>
              </div>
              <div className="joint" aria-hidden="true" />
              <div className="tier tier--core">
                <div className="tier__label"><span>Q²</span><span>held by the institution</span></div>
                <div className="core-steps core-steps--4"><span>Approve</span><span>Record</span><span>Seal</span><span>Disclose</span></div>
              </div>
              <div className="joint" aria-hidden="true" />
              <div className="tier">
                <div className="tier__label"><span>Executing stack</span><span>examples, you choose</span></div>
                <ul className="chips"><li className="chip">Signers: MPC, HSM</li><li className="chip">Custodians</li><li className="chip">Smart accounts</li><li className="chip">Venues</li><li className="chip">Fund administrator</li></ul>
              </div>
            </div>
            <div className="readers">
              <div className="tier__label"><span>Who reads the record</span></div>
              <ul><li>Auditors</li><li>Supervisors</li><li>Fund administrators</li><li>Investors</li><li>Insurers</li><li>Counterparties</li></ul>
            </div>
          </figure>
          <p id="diagram-cap" className="diagram__note">All names are examples, not partners. x402, AP2 and Visa Trusted Agent Protocol are named as examples of agent rails.</p>
        </div>
      </section>

      {/* Capabilities, with status labels */}
      <section className="section-x" id="capabilities" aria-labelledby="caps-title">
        <div className="wrap">
          <div className="head" data-reveal>
            <h2 id="caps-title">Capabilities.</h2>
            <p>Every card says where it stands. <Status s="sandbox" /> try it today on testnet. <Status s="design" /> specified and being built with design partners. <Status s="roadmap" /> planned.</p>
          </div>
          <div className="caps">
            {CAPS.map((c, i) => (
              <article key={c.k} className={`cap shell ${c.span}`} data-reveal data-reveal-delay={(i % 2) * 80} onPointerMove={spotlight} aria-labelledby={`cap-${c.k}`}>
                <div className="shell__core">
                  <div className="cap__top"><h3 id={`cap-${c.k}`}>{c.h}</h3><span className="cap__status">{c.status.map((s) => <Status key={s} s={s} />)}</span></div>
                  <p>{c.p}</p>
                  <code className="cap__f">{c.f}</code>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Regulation: short summary, full page linked */}
      <section className="section-x" id="regulation" aria-labelledby="reg-title">
        <div className="wrap rules">
          <div className="rules__head" data-reveal>
            <h2 id="reg-title">Regulation already asks for this evidence.</h2>
            <p>Records that cannot be altered, every instruction including rejected ones, named approvers, two-person authorisation and cryptography that can be updated. Here are four rules in their own words.</p>
            <div><Pill href="/regulation" onClick={link("/regulation")} variant="ghost">Read all the rules</Pill></div>
            <p className="rules__note">Q² supports your compliance work. It does not replace legal advice, and using it does not by itself make a firm compliant.</p>
          </div>
          <ol className="stack" data-stack>
            {RULES.filter((r) => r.home).map((r, i) => (
              <li key={r.id} style={{ "--i": i }}>
                <div className="stack__card">
                  <div className="stack__top"><span className="mono stack__n">{r.cite}</span><span className={`rstatus rstatus--${r.status.toLowerCase()}`}>{r.status}</span></div>
                  <h3>{r.rule}</h3>
                  <blockquote>“{r.quote}”</blockquote>
                  <p className="maps">What Q² gives you: <b>{r.gives}</b></p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Developers */}
      <section className="section-x" id="developers" aria-labelledby="dev-title">
        <div className="wrap dev">
          <div data-reveal>
            <span className="badge">Preview API · sandbox</span>
            <div className="head" style={{ marginTop: "var(--space-4)", marginBottom: 0 }}>
              <h2 id="dev-title">One call to propose. One record back.</h2>
              <p>The first product is an API for digital-asset firms. It runs today in the sandbox on the Ethereum Sepolia testnet.</p>
            </div>
            <ul className="dev__list">
              <li>Submit a proposal from any system, person or agent.</li>
              <li>Get a quorum or signed-policy decision. Agents never approve.</li>
              <li>Your own signer executes; the record comes back to store, share or verify.</li>
            </ul>
            <div style={{ marginTop: "var(--space-8)" }}><Pill href="/docs" onClick={link("/docs")} variant="ghost">Read the developer docs</Pill></div>
          </div>
          <CodeSample />
        </div>
      </section>

      {/* Start: the design partner ladder */}
      <section className="closing" id="start" aria-labelledby="start-title">
        <Atom3D className="closing__atom" compact label="A diagram of an atom" />
        <div className="wrap">
          <div className="closing__head" data-reveal>
            <h2 id="start-title">Start with a diagnostic.</h2>
            <p>We work with a small group of firms as design partners. Each step is priced so you can stop after it.</p>
          </div>
          <div className="dp">
            <div data-reveal>
              <ol className="ladder">
                <li><span className="mono">01</span><div><h3>Diagnostic <b>from EUR 5,000</b></h3><p>Two to three weeks. We map how your movements are approved and evidenced today, against the rules you answer to. Synthetic data only; no access to your systems or keys.</p></div></li>
                <li><span className="mono">02</span><div><h3>Pilot <b>from USD 20,000, credited to year one</b></h3><p>Eight to twelve weeks on one real flow, with written success criteria.</p></div></li>
                <li><span className="mono">03</span><div><h3>Subscription <b>from USD 24,000 a year</b></h3><p>One entity, your signer and administrator connected, evidence packs, the post-quantum seal.</p></div></li>
              </ol>
              <p className="ladder__more"><a href="/pricing" onClick={link("/pricing")}>See pricing</a> · or <a href="/" onClick={(e) => { e.preventDefault(); enterPlatform("auth"); }}>try the sandbox free</a> on the Ethereum Sepolia testnet.</p>
            </div>
            <div className="shell" data-reveal data-reveal-delay="100"><div className="shell__core shell__core--form"><EnquiryForm onPartnerSignIn={link("/design-partner")} /></div></div>
          </div>
        </div>
      </section>
    </main>
  );
}
