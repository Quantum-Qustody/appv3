import { useEffect, useRef, useState } from "react";
import SignedRecord from "./SignedRecord.jsx";
import Atom3D from "./Atom3D.jsx";
import { initMotion, spotlight } from "./motion.js";

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
    ["Role", f.role || "-"], ["What would you like to govern first?", f.message],
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
    if (!f.message.trim()) e.message = "Tell us one flow you would like to govern.";
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
      <h3 id="dp-form-title">Tell us about your firm</h3>
      <div className="form__row">
        {field("name", "Name", { autoComplete: "name" })}
        {field("email", "Work email", { type: "email", autoComplete: "email", inputMode: "email" })}
      </div>
      <div className="form__row">
        {field("org", "Organisation", { autoComplete: "organization" })}
        {field("role", "Role", { autoComplete: "organization-title" }, true)}
      </div>
      <div className="field">
        <label htmlFor="dp-message">What would you like to govern first?</label>
        <textarea id="dp-message" value={f.message} onChange={set("message")} aria-invalid={!!errors.message} aria-describedby={errors.message ? "dp-message-err" : undefined} placeholder="For example: agent-initiated stablecoin transfers across two custodians." />
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
// Objects: generated with Higgsfield (GPT Image 2.5), background removed,
// cropped and exported as transparent WebP in /public/objects (cut-*).
const Cut = ({ name, className = "", alt = "", eager = false, ...rest }) => (
  <img
    className={`cut ${className}`}
    src={`/objects/cut-${name}-720.webp`}
    srcSet={`/objects/cut-${name}-360.webp 360w, /objects/cut-${name}-720.webp 720w`}
    sizes="(max-width: 760px) 70vw, 420px"
    width="720" height="720" alt={alt}
    loading={eager ? "eager" : "lazy"} decoding="async"
    {...rest}
  />
);

const Pill = ({ children, href, onClick, variant = "primary" }) => (
  <a className={`pill pill--${variant}`} href={href} onClick={onClick}>
    <span>{children}</span>
    <span className="pill__ico" aria-hidden="true"><Arrow /></span>
  </a>
);

const STEPS = [
  {
    id: "step-approve", n: "01", title: "Approve", object: "quorum",
    head: "A quorum before any key signs.",
    body: "A quorum of people, or a policy they signed, approves each movement. Only then does your own key sign. The agent proposes. It never initiates, and no single approver can move assets alone.",
    spec: [["Proposes", "An agent, a system or a person"], ["Decides", "A quorum, or a policy they signed"], ["Signs", "Your MPC or HSM, after the decision"]],
  },
  {
    id: "step-record", n: "02", title: "Record", object: "record",
    head: "One signed record per decision.",
    body: "Q² writes one authority record: who decided, under which mandate, against which policy version, with what result. The format is the same whichever wallet or custodian holds the asset.",
    record: true,
  },
  {
    id: "step-seal", n: "03", title: "Seal", object: "seal",
    head: "Sealed to outlast the algorithm.",
    body: "Each record is sealed with post-quantum signatures and re-sealed as algorithms retire, so the proof stays valid for as long as you must keep it.",
    spec: [["Signature", "ML-DSA-65 (FIPS 204)"], ["Lifetime", "Re-sealed when an algorithm retires"], ["Deadline", "Post-quantum signatures by 31 Dec 2031, US EO 14412"]],
  },
];

const TIERS = [
  {
    name: "Sandbox", price: "Free", unit: "", lede: "Evaluate the governance flow before you commit.",
    items: ["Ethereum Sepolia testnet", "Quorum approvals and signed records", "Agent proposals through the preview API", "Self-serve sign in"],
    cta: "Open the sandbox", action: "sandbox",
  },
  {
    name: "Essentials", price: "$999", unit: "per month", lede: "Your first governed flow in production.", featured: true,
    items: ["Production environment", "$1,000,000 governed volume per quarter", "0.20% per transaction above that", "5 users, 2 workspaces", "Quorum and signed-policy approvals", "Post-quantum sealed records", "MCP server and REST API for agents", "Support 8×5"],
    cta: "Start with Essentials", action: "partner",
  },
  {
    name: "Custom", from: true, price: "$36,000", unit: "per year", lede: "Pro, Enterprise and on-premise.",
    items: ["Custom volume, users and workspaces", "On-premise or in-region, next to your HSM or MPC", "Your own keys for the seal", "Premium SLA and 24/7 support", "Personal onboarding"],
    cta: "Talk to us", action: "partner",
  },
];

// Fireblocks column: exactly as published at fireblocks.com/pricing, checked 13 Oct 2026.
const COMPARE = [
  { k: "Entry plan", q: "$999 per month", f: "$999 per month, for up to 6 months" },
  { k: "Custom plans", q: "From $36,000 per year", f: "From $36,000 per year" },
  { k: "Included volume", q: "$1,000,000 per quarter", f: "$1,000,000 outbound per quarter" },
  { k: "Above included volume", q: "0.20% per transaction", f: "0.20% per transaction" },
  { k: "Users and workspaces", q: "5 users, 2 workspaces", f: "5 users, 2 workspaces" },
  { k: "Approval policies", q: "Quorum or signed policy", f: "Policy Engine" },
  { k: "Keys stay in your own MPC, HSM or custodian", q: "yes", qn: "Q² holds no key share", f: "no" },
  { k: "Post-quantum signatures (ML-DSA)", q: "yes", f: "no" },
  { k: "AI agents over MCP, propose only", q: "yes", qn: "Preview", f: "no" },
  { k: "One signed record across custodians", q: "yes", f: "no" },
  { k: "On-premise deployment", q: "yes", qn: "Custom plan", f: "no" },
];

const Mark = ({ v, note }) => {
  if (v === "yes") return <span className="cmp__yes"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>Included{note && <small>{note}</small>}</span>;
  if (v === "no") return <span className="cmp__no">Not listed</span>;
  return <span>{v}</span>;
};

function CodeTabs() {
  const [tab, setTab] = useState("ts");
  return (
    <figure className="code shell" data-reveal>
      <div className="shell__core">
        <figcaption>
          <div role="tablist" aria-label="Code example" className="tabs">
            <button role="tab" aria-selected={tab === "ts"} aria-controls="code-ts" id="tab-ts" onClick={() => setTab("ts")}>TypeScript</button>
            <button role="tab" aria-selected={tab === "mcp"} aria-controls="code-mcp" id="tab-mcp" onClick={() => setTab("mcp")}>MCP</button>
          </div>
          <span>Preview. Interface may change.</span>
        </figcaption>
        {tab === "ts" ? (
          <pre id="code-ts" role="tabpanel" aria-labelledby="tab-ts" tabIndex={0}><code>
<span className="k">import</span> {"{ Q2 }"} <span className="k">from</span> <span className="s">"@q2/sdk"</span>; <span className="c">// preview</span>{"\n\n"}
<span className="k">const</span> q2 = <span className="k">new</span> Q2({"{"} apiKey: process.env.Q2_API_KEY {"}"});{"\n\n"}
<span className="c">// 1. The agent proposes. It cannot execute on its own.</span>{"\n"}
<span className="k">const</span> proposal = <span className="k">await</span> q2.proposals.create({"{"}{"\n"}
{"  "}actor: <span className="s">"agent:treasury-rebalancer-02"</span>,{"\n"}
{"  "}mandate: <span className="s">"MND-0417"</span>,{"\n"}
{"  "}action: {"{"} type: <span className="s">"transfer"</span>, asset: <span className="s">"USDC"</span>, amount: <span className="s">"120000"</span> {"}"},{"\n"}
{"}"});{"\n\n"}
<span className="c">// 2. People, or a policy they signed, decide.</span>{"\n"}
<span className="k">const</span> decision = <span className="k">await</span> q2.decisions.wait(proposal.id);{"\n\n"}
<span className="c">// 3. Your own key signs. One sealed record comes back.</span>{"\n"}
console.log(decision.record.id);        <span className="c">// "rec_7Q2KF9M4ZP"</span>{"\n"}
console.log(decision.record.signature); <span className="c">// "ML-DSA-65"</span>
          </code></pre>
        ) : (
          <pre id="code-mcp" role="tabpanel" aria-labelledby="tab-mcp" tabIndex={0}><code>
<span className="c">// An agent connected over MCP sees three tools.</span>{"\n"}
<span className="c">// It can propose and read. It cannot approve or sign.</span>{"\n\n"}
<span className="k">tools</span>  propose_transfer · get_decision · get_record{"\n\n"}
<span className="k">call</span>   propose_transfer{"\n"}
{"{"}{"\n"}
{"  "}<span className="s">"asset"</span>: <span className="s">"USDC"</span>,{"\n"}
{"  "}<span className="s">"amount"</span>: <span className="s">"120000"</span>,{"\n"}
{"  "}<span className="s">"to"</span>: <span className="s">"venue:allowlisted-lending-01"</span>,{"\n"}
{"  "}<span className="s">"mandate"</span>: <span className="s">"MND-0417"</span>{"\n"}
{"}"}{"\n\n"}
<span className="k">result</span>{"\n"}
{"{"} <span className="s">"proposal"</span>: <span className="s">"prp_4KD2Q"</span>, <span className="s">"status"</span>: <span className="s">"pending_approval"</span>, <span className="s">"quorum"</span>: <span className="s">"2 of 3"</span> {"}"}
          </code></pre>
        )}
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
          <h2 id="how-title" data-reveal>One decision.<br />One record. One seal.</h2>
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
            {STEPS.map((s, i) => <Cut key={s.object} name={s.object} className={i === active ? "is-on" : ""} />)}
          </div>
        </div>
        <div className="story__steps" id="story-steps">
          <span className="story__rail" aria-hidden="true"><span data-progress="story-steps" /></span>
          {STEPS.map((s, i) => (
            <article key={s.id} id={s.id} data-i={i} className="story__step" aria-labelledby={`${s.id}-h`}>
              <p className="story__n mono">{s.n} · {s.title}</p>
              <h3 id={`${s.id}-h`}>{s.head}</h3>
              <p className="story__body">{s.body}</p>
              <Cut name={s.object} className="story__inline" />
              {s.spec && (
                <dl className="spec">
                  {s.spec.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
                </dl>
              )}
              {s.record && <SignedRecord />}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Landing({ go, enterPlatform }) {
  const root = useRef(null);
  const hero = useRef(null);
  const scrollTo = (id) => (e) => { e?.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const link = (path) => (e) => { e.preventDefault(); go(path); };
  const tierAction = (a) => (e) => { e.preventDefault(); if (a === "sandbox") enterPlatform("auth"); else scrollTo("partner")(); };

  useEffect(() => initMotion(root.current), []);

  return (
    <main id="main" ref={root} className="lp">
      {/* Hero */}
      <section className="hero" ref={hero} aria-labelledby="hero-title">
        <div className="hero__wash" aria-hidden="true" />
        <Atom3D className="hero__atom" scrollRef={hero} />
        <div className="wrap hero__in" data-hero>
          <h1 id="hero-title"><span>Self-custody,</span> <span>built for regulated finance.</span></h1>
          <p className="hero__for">For vaults, funds and AI agents.</p>
          <div className="hero__ctas">
            <Pill href="#partner" onClick={scrollTo("partner")}>Become a design partner</Pill>
            <Pill href="#pricing" onClick={scrollTo("pricing")} variant="ghost">See pricing</Pill>
          </div>
        </div>
      </section>

      {/* Statement */}
      <section className="statement" id="why" aria-label="Why Q²">
        <div className="wrap">
          <p className="statement__text" data-scrub-words>
            You hold the keys. <strong>Q² proves every decision made with them.</strong>
          </p>
        </div>
      </section>

      {/* Proof points */}
      <section className="proofs-band" id="problem" aria-labelledby="problem-title">
        <div className="wrap">
          <h2 id="problem-title" className="sr-only">Why it matters now</h2>
          <ul className="stats">
            <li className="stat shell" data-reveal>
              <div className="shell__core">
                <p className="stat__big"><span className="num">“difficult or impossible”</span></p>
                <p className="stat__k">Agent actions can be this hard to reverse.<sup className="fn">1</sup></p>
                <p className="stat__src"><sup>1</sup> Financial Stability Board, consultation report on AI agents, 10 June 2026.</p>
              </div>
            </li>
            <li className="stat shell" data-reveal data-reveal-delay="100">
              <div className="shell__core">
                <p className="stat__big"><span className="num" data-count="61">61</span><span className="num">%</span></p>
                <p className="stat__k">of institutional investors use several custodians.<sup className="fn">2</sup></p>
                <p className="stat__src"><sup>2</sup> EY, institutional investor digital assets survey, January 2026.</p>
              </div>
            </li>
            <li className="stat shell" data-reveal data-reveal-delay="200">
              <div className="shell__core">
                <p className="stat__big"><span className="num" data-count="2031">2031</span></p>
                <p className="stat__k">Post-quantum signatures required by 31 December.<sup className="fn">3</sup></p>
                <p className="stat__src"><sup>3</sup> US Executive Order 14412.</p>
              </div>
            </li>
          </ul>
        </div>
      </section>

      {/* Bento: the moat */}
      <section className="section-x" id="features" aria-labelledby="features-title">
        <div className="wrap">
          <div className="head" data-reveal>
            <h2 id="features-title">Built for desks that hold their own keys.</h2>
            <p>Everything sits between your agents and your keys. Nothing takes the keys away from you.</p>
          </div>
          <div className="bento">
            <article className="card card--a shell" onPointerMove={spotlight} data-reveal>
              <div className="shell__core">
                <h3>Your keys stay yours.</h3>
                <p>Q² works with the MPC, HSM or custodian you already run. It never holds a key share and never moves assets on its own.</p>
                <ul className="tags"><li>MPC</li><li>HSM</li><li>Any custodian</li></ul>
                <Cut name="custody" className="card__obj" data-scale-in />
              </div>
            </article>
            <article className="card card--b shell" onPointerMove={spotlight} data-reveal data-reveal-delay="80">
              <div className="shell__core">
                <h3>Sealed past 2031.</h3>
                <p>Every record is signed with ML-DSA-65 and re-sealed as algorithms retire.</p>
                <Cut name="seal" className="card__obj card__obj--sm" />
              </div>
            </article>
            <article className="card card--c shell" onPointerMove={spotlight} data-reveal data-reveal-delay="160">
              <div className="shell__core">
                <h3>Agents propose. People decide.</h3>
                <p>Connect agents through an MCP server or the REST API. An agent can submit a proposal. It can never approve or sign.</p>
                <code className="card__code">propose_transfer · get_decision · get_record</code>
              </div>
            </article>
            <article className="card card--d shell" onPointerMove={spotlight} data-reveal>
              <div className="shell__core">
                <h3>One record, every custodian.</h3>
                <p>The same signed authority record, whoever holds the asset.</p>
                <Cut name="record" className="card__obj card__obj--sm" />
              </div>
            </article>
            <article className="card card--e shell" onPointerMove={spotlight} data-reveal data-reveal-delay="80">
              <div className="shell__core">
                <h3>Runs where your keys live.</h3>
                <div className="deploy3">
                  <div><b>On-premise</b><span>Inside your infrastructure, next to your HSM or MPC cluster. Q² never sees the data.</span></div>
                  <div><b>In-region</b><span>Records and signing keys stay within your residency requirements.</span></div>
                  <div><b>Cloud</b><span>Run by Q². The fastest way to a sandbox and a first pilot.</span></div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <Story />

      {/* Where it sits */}
      <section className="section-x" id="where" aria-labelledby="where-title">
        <div className="wrap">
          <div className="head" data-reveal>
            <h2 id="where-title">Between your agents and your keys.</h2>
            <p>Agent rails sit above Q². Your keys sit below it, in self-custody or with any custodian. Auditors, supervisors, insurers and counterparties read the record.</p>
          </div>
          <figure className="diagram" aria-labelledby="diagram-cap" style={{ margin: 0 }} data-reveal>
            <div className="diagram__stack">
              <div className="tier">
                <div className="tier__label"><span>Agent rails</span><span>examples, not partners</span></div>
                <ul className="chips"><li className="chip">x402</li><li className="chip">AP2</li><li className="chip">Visa TAP</li><li className="chip">Your own agents</li></ul>
              </div>
              <div className="joint" aria-hidden="true" />
              <div className="tier tier--core">
                <div className="tier__label"><span>Q²</span><span>held by the institution</span></div>
                <div className="core-steps"><span>Approve</span><span>Record</span><span>Seal</span></div>
              </div>
              <div className="joint" aria-hidden="true" />
              <div className="tier">
                <div className="tier__label"><span>Your keys</span><span>you choose where</span></div>
                <ul className="chips"><li className="chip">Self-custody: MPC</li><li className="chip">Self-custody: HSM</li><li className="chip">Institutional custodians</li></ul>
              </div>
            </div>
            <div className="readers">
              <div className="tier__label"><span>Who reads the record</span></div>
              <ul><li>Auditors</li><li>Supervisors</li><li>Insurers</li><li>Counterparties</li></ul>
            </div>
          </figure>
          <p id="diagram-cap" className="diagram__note">x402, AP2 and Visa Trusted Agent Protocol are named as examples of agent rails. They are not partners of Q².</p>
        </div>
      </section>

      {/* Rules: stacking cards */}
      <section className="section-x" id="rules" aria-labelledby="rules-title">
        <div className="wrap rules">
          <div className="rules__head" data-reveal>
            <h2 id="rules-title">Built for the rules you answer to.</h2>
            <p>Q² is designed to map to these obligations. It supports your compliance work. It does not replace legal advice, and using it does not by itself make a firm compliant.</p>
          </div>
          <ol className="stack" data-stack>
            {[
              ["DORA", "EU rules on digital operational resilience. Logs must be complete and protected against tampering.", "signed, append-only authority records"],
              ["MiCA", "EU rules for crypto-asset service providers, including safeguarding and record keeping.", "per-movement records with mandate and policy version"],
              ["FSB guidance on AI", "Financial Stability Board work on AI agents in finance, including oversight and reversibility.", "a human or policy quorum before any agent action"],
              ["EO 14412", "US Executive Order setting post-quantum signatures by 31 December 2031.", "ML-DSA signatures, re-sealed as algorithms retire"],
            ].map(([t, d, m], i) => (
              <li key={t} style={{ "--i": i }}>
                <div className="stack__card">
                  <span className="mono stack__n">{String(i + 1).padStart(2, "0")}</span>
                  <h3>{t}</h3>
                  <p>{d}</p>
                  <p className="maps">Maps to: <b>{m}</b></p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Pricing */}
      <section className="section-x pricing" id="pricing" aria-labelledby="pricing-title">
        <div className="wrap">
          <div className="head head--center" data-reveal>
            <h2 id="pricing-title">Fireblocks prices. Self-custody built in.</h2>
            <p>Q² charges what Fireblocks publishes for its plans, so the comparison comes down to what you get. Prices in US dollars, excluding tax.</p>
          </div>
          <div className="tiers">
            {TIERS.map((t, i) => (
              <article key={t.name} className={`tier-card shell ${t.featured ? "is-featured" : ""}`} data-reveal data-reveal-delay={i * 90} onPointerMove={spotlight} aria-labelledby={`tier-${t.name}`}>
                <div className="shell__core">
                  {t.featured && <span className="tier-card__flag">Start here</span>}
                  <h3 id={`tier-${t.name}`}>{t.name}</h3>
                  <p className="tier-card__price">{t.from && <span className="tier-card__from">From</span>}<b>{t.price}</b>{t.unit && <span> {t.unit}</span>}</p>
                  <p className="tier-card__lede">{t.lede}</p>
                  <ul>{t.items.map((it) => <li key={it}>{it}</li>)}</ul>
                  <Pill href={t.action === "sandbox" ? "/" : "#partner"} onClick={tierAction(t.action)} variant={t.featured ? "primary" : "ghost"}>{t.cta}</Pill>
                </div>
              </article>
            ))}
          </div>

          <div className="cmp shell" data-reveal>
            <div className="shell__core">
              <h3 className="cmp__title">Q² Essentials and Fireblocks Essentials, side by side</h3>
              <div className="cmp__scroll" tabIndex={0} role="region" aria-label="Comparison table">
                <table>
                  <thead>
                    <tr><th scope="col"><span className="sr-only">Item</span></th><th scope="col" className="cmp__q">Q²</th><th scope="col">Fireblocks<sup className="fn">4</sup></th></tr>
                  </thead>
                  <tbody>
                    {COMPARE.map((r) => (
                      <tr key={r.k} className={r.q === "yes" ? "is-moat" : ""}>
                        <th scope="row">{r.k}</th>
                        <td className="cmp__q"><Mark v={r.q} note={r.qn} /></td>
                        <td><Mark v={r.f} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="cmp__src">
                <sup>4</sup> Fireblocks figures as published at <a href="https://www.fireblocks.com/pricing" target="_blank" rel="noopener noreferrer">fireblocks.com/pricing</a>, checked on 13 October 2026.
                “Not listed” means the item does not appear on that page; it may be available from Fireblocks on request.
                Fireblocks is a trademark of its owner. Q² is not affiliated with Fireblocks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* For whom */}
      <section className="section-x" id="who" aria-labelledby="who-title">
        <div className="wrap">
          <div className="head" data-reveal>
            <h2 id="who-title">For firms that hold their own keys and must prove every movement.</h2>
          </div>
          <div className="who">
            {[
              ["Multi-custodian funds and RWA issuers", "Assets sit in self-custody, with several custodians and on several chains.", "One record per decision, whoever holds the key."],
              ["EU CASPs and EMIs", "Licensed firms whose supervisors ask how each movement was authorised.", "Records an examiner can read without your internal tools."],
              ["Agent operators and PSPs", "Teams running agents or payment flows that move funds for clients.", "A gate before the agent acts, and proof after it."],
            ].map(([h, p, n], i) => (
              <div className="who__item" key={h} data-reveal data-reveal-delay={i * 90}><h3>{h}</h3><p>{p}</p><p className="need">{n}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* Developers */}
      <section className="section-x" id="developers" aria-labelledby="dev-title">
        <div className="wrap dev">
          <div data-reveal>
            <span className="badge">Preview API and MCP</span>
            <div className="head" style={{ marginTop: "var(--space-4)", marginBottom: 0 }}>
              <h2 id="dev-title">One call to propose. One record back.</h2>
              <p>The first product is an API for digital-asset firms, with an MCP server so AI agents can propose movements directly. A mobile approval app follows.</p>
            </div>
            <ul className="dev__list">
              <li>Submit a proposal from any agent or system.</li>
              <li>Get a quorum or signed-policy decision. Agents never initiate.</li>
              <li>Sign with your own keys, then store, share or verify the record.</li>
            </ul>
          </div>
          <CodeTabs />
        </div>
      </section>

      {/* Closing: design partner */}
      <section className="closing" id="partner" aria-labelledby="partner-title">
        <Atom3D className="closing__atom" compact label="A glass atom" poster={false} />
        <div className="wrap">
          <div className="closing__head" data-reveal>
            <h2 id="partner-title">Keep the keys.<br />Keep the proof.</h2>
            <p>We are working with a small group of firms to shape Q² around real operations. Design partners get direct input into the API and the record format, a diagnostic of how movements are approved today, early access to the sandbox and the preview API, and founder-level support from diagnostic to production.</p>
          </div>
          <div className="dp">
            <ol className="stages" data-reveal>
              <li><h3>Diagnostic <span>stage 1</span></h3><p>We map how assets move, who approves and how you prove control today. Synthetic data only, no access to your systems or keys.</p></li>
              <li><h3>Paid pilot <span>stage 2</span></h3><p>Q² runs alongside one real flow, in a bounded scope, against success criteria we agree together.</p></li>
              <li><h3>Production <span>stage 3</span></h3><p>Q² becomes the record of decision for the flows you choose, deployed where your data must live.</p></li>
            </ol>
            <div className="shell" data-reveal data-reveal-delay="100"><div className="shell__core shell__core--form"><EnquiryForm onPartnerSignIn={link("/design-partner")} /></div></div>
          </div>
          <p className="closing__sandbox">
            Want to see the governance flow today?{" "}
            <a href="/" onClick={(e) => { e.preventDefault(); enterPlatform("auth"); }}>Open the evaluation sandbox</a>{" "}
            on the Ethereum Sepolia testnet.
          </p>
        </div>
      </section>
    </main>
  );
}
