import { useState } from "react";
import SignedRecord from "./SignedRecord.jsx";

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

// The object family. Generated with Higgsfield (GPT Image 2.5) on paper, and
// again on ink for the dark theme, then graded, grained and cropped. Widths are
// the real pixel widths of each file in /public/objects.
const OBJECTS = {
  atom:    { w: [560, 880], ratio: 1,    dark: { name: "atom-ink", w: [560, 752] } },
  custody: { w: [560, 704], ratio: 1.25, dark: { name: "custody-ink", w: [560, 819] } },
  quorum:  { w: [560, 819], ratio: 1.25, dark: { name: "quorum-ink", w: [560, 819] } },
  record:  { w: [560, 819], ratio: 1.25, dark: { name: "record-ink", w: [560, 820] } },
  seal:    { w: [560, 819], ratio: 1.25, dark: { name: "seal-ink", w: [560, 820] } },
};
const srcset = (name, ws) => ws.map((w, i) => `/objects/${name}-${i ? 960 : 560}.webp ${w}w`).join(", ");

function Plate({ name, n, title, note, eager = false, className = "" }) {
  const o = OBJECTS[name];
  const sizes = "(max-width: 860px) 92vw, 560px";
  return (
    <figure className={`plate ${className}`}>
      <picture>
        {o.dark && <source media="(prefers-color-scheme: dark)" srcSet={srcset(o.dark.name, o.dark.w)} sizes={sizes} />}
        <img
          src={`/objects/${name}-560.webp`}
          srcSet={srcset(name, o.w)}
          sizes={sizes}
          width={560}
          height={Math.round(560 * o.ratio)}
          alt=""
          loading={eager ? "eager" : "lazy"}
          decoding={eager ? "sync" : "async"}
          {...(eager ? { fetchpriority: "high" } : {})}
        />
      </picture>
      <figcaption>
        <span className="plate__n">{n}</span>
        <span className="plate__t">{title}</span>
        {note && <span className="plate__note">{note}</span>}
      </figcaption>
    </figure>
  );
}

const CHAPTERS = [
  { id: "custody", n: "01", name: "Custody", line: "Your keys stay where they are." },
  { id: "approve", n: "02", name: "Approve", line: "A quorum decides before any key signs." },
  { id: "record", n: "03", name: "Record", line: "One signed record per decision." },
  { id: "seal", n: "04", name: "Seal", line: "Proof that outlasts the algorithm." },
];

export default function Landing({ go, enterPlatform }) {
  const scrollTo = (id) => (e) => { e?.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const link = (path) => (e) => { e.preventDefault(); go(path); };

  return (
    <main id="main">
      {/* Hero · diptych: claim left, nucleus right */}
      <section className="hero" aria-labelledby="hero-title">
        <div className="wrap hero__grid">
          <div className="hero__text">
            <h1 id="hero-title"><span>Keep your keys.</span> <span>Prove every decision.</span></h1>
            <p className="hero__usp">
              <strong>Q² is the decision assurance layer for agentic finance.</strong> Your keys stay in your own
              MPC or HSM. Q² decides who may approve each movement, by people or AI agents, and gives you one signed
              record of it that stays valid past the post-quantum deadline.
            </p>
            <div className="hero__ctas">
              <a className="btn btn--primary" href="#partner" onClick={scrollTo("partner")}>Become a design partner <Arrow /></a>
              <a className="btn btn--secondary" href="/research" onClick={link("/research")}>Read the research</a>
            </div>
            <p className="hero__note">Q² is not a custodian. It never holds your keys or your assets.</p>
          </div>
          <Plate name="atom" n="Fig. 00" title="Nucleus" note="Your keys at the centre. Every decision in orbit." eager className="plate--hero" />
        </div>
      </section>

      {/* Index · the four chapters, read like a catalogue contents page */}
      <nav className="index" id="how" aria-label="How Q² works">
        <div className="wrap">
          <ol className="index__list">
            {CHAPTERS.map((c) => (
              <li key={c.id}>
                <a href={`#${c.id}`} onClick={scrollTo(c.id)}>
                  <span className="index__n">{c.n}</span>
                  <span className="index__name">{c.name}</span>
                  <span className="index__line">{c.line}</span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      </nav>

      {/* 01 · Custody */}
      <section className="chapter" id="custody" aria-labelledby="custody-title">
        <div className="wrap diptych">
          <Plate name="custody" n="Fig. 01" title="Custody" note="The core stays inside the glass." />
          <div className="chapter__text">
            <p className="chapter__n">01 · Custody</p>
            <h2 id="custody-title">Self-custody settled who holds the keys. Not who decided.</h2>
            <p className="chapter__lede">
              MPC and HSMs keep keys out of reach. But a key signs whatever it is asked to sign. When an agent
              proposes a transfer, the approval sits in a chat thread, the evidence sits with several wallets and
              custodians, and none of it is built to outlast the cryptography it was signed with.
            </p>
            <dl className="facts">
              <div><dt>No gate before the action</dt><dd>On most agent rails the agent can initiate. Approval is a setting, not a step that leaves proof. Once funds move on chain, reversal is rarely an option.</dd></div>
              <div><dt>No single record after it</dt><dd>Each custodian, wallet and payment rail keeps its own log in its own format. An auditor receives fragments, not a decision.</dd></div>
            </dl>
          </div>
        </div>
      </section>

      {/* Why now · sourced proof points */}
      <section className="section section--tint" id="problem" aria-labelledby="problem-title">
        <div className="wrap">
          <div className="sh">
            <h2 id="problem-title">Why it matters now.</h2>
          </div>
          <ul className="proofs">
            <li className="proof">
              <span className="proof__k">Agents need a gate</span>
              <p className="proof__big">Agent actions can be “difficult or impossible” to reverse.<sup className="fn">1</sup></p>
              <p className="proof__src"><sup>1</sup> Financial Stability Board, consultation report on AI agents, 10 June 2026.</p>
            </li>
            <li className="proof">
              <span className="proof__k">Evidence is split</span>
              <p className="proof__big"><span className="num">61%</span> of institutional investors use several custodians.<sup className="fn">2</sup></p>
              <p className="proof__src"><sup>2</sup> EY, institutional investor digital assets survey, January 2026.</p>
            </li>
            <li className="proof">
              <span className="proof__k">The clock is set</span>
              <p className="proof__big">Tamper-proof logs today. Post-quantum signatures by <span className="num">31 Dec 2031</span>.<sup className="fn">3</sup></p>
              <p className="proof__src"><sup>3</sup> DORA, Regulation (EU) 2022/2554. US Executive Order 14412.</p>
            </li>
          </ul>
        </div>
      </section>

      {/* 02 · Approve */}
      <section className="chapter" id="approve" aria-labelledby="approve-title">
        <div className="wrap diptych diptych--flip">
          <Plate name="quorum" n="Fig. 02" title="Quorum" note="No single ring carries the weight." />
          <div className="chapter__text">
            <p className="chapter__n">02 · Approve</p>
            <h2 id="approve-title">A quorum before any key signs.</h2>
            <p className="chapter__lede">
              A quorum of people, or a policy they signed, approves each movement. Only then does your own
              key sign. The agent proposes. It never initiates, and no single approver can move assets alone.
            </p>
            <dl className="spec">
              <div><dt>Proposes</dt><dd>An agent, a system or a person</dd></div>
              <div><dt>Decides</dt><dd>A quorum, or a policy they signed</dd></div>
              <div><dt>Signs</dt><dd>Your MPC or HSM, after the decision</dd></div>
            </dl>
          </div>
        </div>
      </section>

      {/* 03 · Record */}
      <section className="chapter chapter--tint" id="record" aria-labelledby="record-title">
        <div className="wrap diptych diptych--top">
          <Plate name="record" n="Fig. 03" title="Record" note="One plate per decision. The violet one is yours." className="plate--sticky" />
          <div className="chapter__text">
            <p className="chapter__n">03 · Record</p>
            <h2 id="record-title">One signed record per decision.</h2>
            <p className="chapter__lede">
              Q² writes one authority record: who decided, under which mandate, against which policy version,
              with what result. The format is the same whichever wallet or custodian holds the asset, so an
              auditor reads a decision, not fragments.
            </p>
            <SignedRecord />
          </div>
        </div>
      </section>

      {/* 04 · Seal */}
      <section className="chapter" id="seal" aria-labelledby="seal-title">
        <div className="wrap diptych diptych--flip">
          <Plate name="seal" n="Fig. 04" title="Seal" note="Closed once, re-sealed as algorithms retire." />
          <div className="chapter__text">
            <p className="chapter__n">04 · Seal</p>
            <h2 id="seal-title">Sealed to outlast the algorithm.</h2>
            <p className="chapter__lede">
              Each record is sealed with post-quantum signatures and re-sealed as algorithms retire, so the
              proof stays valid for as long as you must keep it.
            </p>
            <dl className="spec">
              <div><dt>Signature</dt><dd>ML-DSA-65</dd></div>
              <div><dt>Lifetime</dt><dd>Re-sealed when an algorithm retires</dd></div>
              <div><dt>Deadline</dt><dd>Post-quantum signatures by 31 Dec 2031, US EO 14412</dd></div>
            </dl>
          </div>
        </div>
      </section>

      {/* Ink chapter · self-custody of the proof, and where it runs */}
      <section className="ink" id="deploy" aria-labelledby="deploy-title">
        <div className="ink__art" aria-hidden="true">
          <img src="/objects/orbit-ink-960.webp" srcSet="/objects/orbit-ink-960.webp 960w, /objects/orbit-ink-1344.webp 1344w" sizes="(max-width: 860px) 100vw, 70vw" width="1344" height="752" alt="" loading="lazy" decoding="async" />
        </div>
        <div className="wrap ink__in">
          <div className="ink__head">
            <h2 id="deploy-title">Self-custody, extended to the proof.</h2>
            <p>You hold the keys. With Q² you also hold the record of every decision made with them, stored and signed where your data must live.</p>
          </div>
          <ul className="ink__opts">
            <li><h3>On-premise</h3><p>Runs inside your own infrastructure, next to your HSM or MPC cluster. Q² never sees the data.</p></li>
            <li><h3>In-region</h3><p>Runs in the region you choose, so records and signing keys stay within your residency requirements.</p></li>
            <li><h3>Cloud</h3><p>Run by Q². The fastest way to start, suited to a sandbox and a first pilot.</p></li>
          </ul>
        </div>
      </section>

      {/* Where it sits */}
      <section className="section" id="where" aria-labelledby="where-title">
        <div className="wrap">
          <div className="sh">
            <h2 id="where-title">Between your agents and your keys.</h2>
            <p>Agent rails sit above Q². Your keys sit below it, in self-custody or with any custodian. Auditors, supervisors, insurers and counterparties read the record.</p>
          </div>
          <figure className="diagram" aria-labelledby="diagram-cap" style={{ margin: 0 }}>
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
          <p id="diagram-cap" className="diagram__note">Agent rails sit above Q², keys below it, readers to the side. x402, AP2 and Visa Trusted Agent Protocol are named as examples of agent rails. They are not partners of Q².</p>
        </div>
      </section>

      {/* Built for the rules */}
      <section className="section section--tint" id="rules" aria-labelledby="rules-title">
        <div className="wrap">
          <div className="sh">
            <h2 id="rules-title">Built for the rules you answer to.</h2>
            <p>Q² is designed to map to the obligations below. It supports your compliance work. It does not replace legal advice, and using it does not by itself make a firm compliant.</p>
          </div>
          <ul className="ruled">
            <li><h3>DORA</h3><p>EU rules on digital operational resilience. Logs must be complete and protected against tampering.</p><span className="maps">Maps to: <b>signed, append-only authority records</b></span></li>
            <li><h3>MiCA</h3><p>EU rules for crypto-asset service providers, including safeguarding and record keeping.</p><span className="maps">Maps to: <b>per-movement records with mandate and policy version</b></span></li>
            <li><h3>FSB guidance on AI</h3><p>Financial Stability Board work on AI agents in finance, including oversight and reversibility.</p><span className="maps">Maps to: <b>a human or policy quorum before any agent action</b></span></li>
            <li><h3>EO 14412</h3><p>US Executive Order setting post-quantum signatures by 31 December 2031.</p><span className="maps">Maps to: <b>ML-DSA signatures, re-sealed as algorithms retire</b></span></li>
          </ul>
        </div>
      </section>

      {/* For whom */}
      <section className="section" id="who" aria-labelledby="who-title">
        <div className="wrap">
          <div className="sh">
            <h2 id="who-title">For firms that hold their own keys and must prove every movement.</h2>
          </div>
          <div className="who">
            <div className="who__item"><h3>Multi-custodian funds and RWA issuers</h3><p>Assets sit in self-custody, with several custodians and on several chains.</p><p className="need">One record per decision, whoever holds the key.</p></div>
            <div className="who__item"><h3>EU CASPs and EMIs</h3><p>Licensed firms whose supervisors ask how each movement was authorised.</p><p className="need">Records an examiner can read without your internal tools.</p></div>
            <div className="who__item"><h3>Agent operators and PSPs</h3><p>Teams running agents or payment flows that move funds for clients.</p><p className="need">A gate before the agent acts, and proof after it.</p></div>
          </div>
        </div>
      </section>

      {/* Developers */}
      <section className="section section--tint" id="developers" aria-labelledby="dev-title">
        <div className="wrap dev">
          <div>
            <span className="badge">Preview API</span>
            <div className="sh" style={{ marginTop: "var(--space-4)", marginBottom: 0 }}>
              <h2 id="dev-title">One call to propose. One record back.</h2>
              <p>The first product is an API for digital-asset firms. A mobile approval app follows. Zero-knowledge and post-quantum suites come later.</p>
            </div>
            <ul className="dev__list">
              <li>Submit a proposal from any agent or system.</li>
              <li>Get a quorum or signed-policy decision. Agents never initiate.</li>
              <li>Sign with your own keys, then store, share or verify the record.</li>
            </ul>
          </div>
          <figure className="code">
            <figcaption><span>propose-and-record.ts</span><span>Preview. Interface may change.</span></figcaption>
            <pre tabIndex={0} aria-label="TypeScript example: submit an agent proposal, wait for a quorum decision, read the signed record"><code>
<span className="k">import</span> {"{ Q2 }"} <span className="k">from</span> <span className="s">"@q2/sdk"</span>; <span className="c">// preview</span>{"\n\n"}
<span className="k">const</span> q2 = <span className="k">new</span> Q2({"{"} apiKey: process.env.Q2_API_KEY {"}"});{"\n\n"}
<span className="c">// 1. The agent proposes. It cannot execute on its own.</span>{"\n"}
<span className="k">const</span> proposal = <span className="k">await</span> q2.proposals.create({"{"}{"\n"}
{"  "}actor: <span className="s">"agent:treasury-rebalancer-02"</span>,{"\n"}
{"  "}mandate: <span className="s">"MND-0417"</span>,{"\n"}
{"  "}action: {"{"} type: <span className="s">"transfer"</span>, asset: <span className="s">"USDC"</span>, amount: <span className="s">"120000"</span>,{"\n"}
{"            "}to: <span className="s">"venue:allowlisted-lending-01"</span> {"}"},{"\n"}
{"}"});{"\n\n"}
<span className="c">// 2. People, or a policy they signed, decide.</span>{"\n"}
<span className="k">const</span> decision = <span className="k">await</span> q2.decisions.wait(proposal.id);{"\n"}
<span className="c">// decision.outcome === "approved", decision.quorum === "2/3"</span>{"\n\n"}
<span className="c">// 3. One signed authority record comes back.</span>{"\n"}
console.log(decision.record.id);        <span className="c">// "rec_7Q2KF9M4ZP"</span>{"\n"}
console.log(decision.record.signature); <span className="c">// "ML-DSA-65"</span>
            </code></pre>
          </figure>
        </div>
      </section>

      {/* Design partner programme */}
      <section className="section" id="partner" aria-labelledby="partner-title">
        <div className="wrap dp">
          <div>
            <div className="sh" style={{ marginBottom: "var(--space-8)" }}>
              <h2 id="partner-title">Become a design partner.</h2>
              <p>We are working with a small group of firms to shape Q² around real operations. Design partners get:</p>
            </div>
            <ul className="gets">
              <li>Direct input into the API and the record format.</li>
              <li>A diagnostic of how movements are approved and evidenced today.</li>
              <li>Early access to the sandbox and the preview API.</li>
              <li>Founder-level support from diagnostic to production.</li>
            </ul>
            <ol className="stages">
              <li><h3>Diagnostic <span>stage 1</span></h3><p>We map how assets move, who approves and how you prove control today. Synthetic data only, no access to your systems or keys.</p></li>
              <li><h3>Paid pilot <span>stage 2</span></h3><p>Q² runs alongside one real flow, in a bounded scope, against success criteria we agree together.</p></li>
              <li><h3>Production <span>stage 3</span></h3><p>Q² becomes the record of decision for the flows you choose, deployed where your data must live.</p></li>
            </ol>
          </div>
          <EnquiryForm onPartnerSignIn={link("/design-partner")} />
        </div>
      </section>

      <p className="wrap" style={{ paddingBlock: "var(--space-8)", fontSize: "var(--text-sm)", color: "var(--q-ink-3)" }}>
        Want to see the governance flow today?{" "}
        <a href="/" onClick={(e) => { e.preventDefault(); enterPlatform("auth"); }}>Open the evaluation sandbox</a>{" "}
        on the Ethereum Sepolia testnet.
      </p>
    </main>
  );
}
