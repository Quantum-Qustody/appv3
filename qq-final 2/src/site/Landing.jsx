import { useEffect, useRef, useState } from "react";
import SignedRecord from "./SignedRecord.jsx";
import Atom3D from "./Atom3D.jsx";
import { initMotion, spotlight } from "./motion.js";
import { FILMS, EXAMPLE } from "./filmsList.js";
import {
  INCIDENTS, PATTERNS, FOUR, SIX, FLOWS, SENDS, RECEIVES, PINS, GRADES, LANES, SECTORS,
  ADDONS, BASE_RULES, BASE_EVIDENCE, TIMELINE, HOME_RULES, NEVER, LADDER, CRITERIA, FAQ,
} from "./content.js";

export const Arrow = () => (
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
    ["Role", f.role || "-"], ["Which movement would you like to bring?", f.message],
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
      sections: [{ section: "Call request (website)", items }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.stored) throw new Error(data?.store_error || data?.error || `Request failed (${res.status})`);
  return data;
}

export function EnquiryForm({ onPartnerSignIn }) {
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
    if (!f.message.trim()) e.message = "Tell us one movement you would like evidenced.";
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
        <h3>Thank you. We have your request.</h3>
        <p style={{ color: "var(--q-ink-2)" }}>We will reply to {f.email} to set a time.</p>
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
      <h3 id="dp-form-title">Book a 30-minute call</h3>
      <div className="form__row">
        {field("name", "Name", { autoComplete: "name" })}
        {field("email", "Work email", { type: "email", autoComplete: "email", inputMode: "email" })}
      </div>
      <div className="form__row">
        {field("org", "Organisation", { autoComplete: "organization" })}
        {field("role", "Role", { autoComplete: "organization-title" }, true)}
      </div>
      <div className="field">
        <label htmlFor="dp-message">Which movement would you like to bring?</label>
        <textarea id="dp-message" value={f.message} onChange={set("message")} aria-invalid={!!errors.message} aria-describedby={errors.message ? "dp-message-err" : undefined} placeholder="For example: loan drawdowns from our fund wallet, approved by two partners." />
        {errors.message && <span id="dp-message-err" className="field__err">{errors.message}</span>}
      </div>
      <div>
        <label className="check">
          <input type="checkbox" checked={f.consent} onChange={set("consent")} aria-invalid={!!errors.consent} />
          <span>Q Squared may use these details to contact me. Do not include credentials, keys or client data.</span>
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
          {state === "sending" ? "Sending" : "Request a call"} {state !== "sending" && <Arrow />}
        </button>
        <small>
          Already a design partner? <a href="/design-partner" onClick={onPartnerSignIn}>Sign in to your intake</a>
        </small>
      </div>
    </form>
  );
}

export const Pill = ({ children, href, onClick, variant = "primary" }) => (
  <a className={`pill pill--${variant}`} href={href} onClick={onClick}>
    <span>{children}</span>
    <span className="pill__ico" aria-hidden="true"><Arrow /></span>
  </a>
);

// Kept for pages that still describe build status (developer docs).
export const STATUS = {
  sandbox: { label: "Sandbox", title: "Try it today on testnet" },
  design: { label: "In design", title: "Specified and being built with design partners" },
  roadmap: { label: "Roadmap", title: "Planned" },
};
export const Status = ({ s }) => <span className={`status status--${s}`} title={STATUS[s].title}>{STATUS[s].label}</span>;

// Section header with the blueprint's section number.
export function SecHead({ n, id, title, children, wide }) {
  return (
    <div className={`head bp-head ${wide ? "bp-head--wide" : ""}`} data-reveal>
      {n && <span className="bp-n mono" aria-hidden="true">{n}</span>}
      <h2 id={id}>{title}</h2>
      {children}
    </div>
  );
}

function IncidentChart() {
  const max = INCIDENTS[0][2];
  return (
    <figure className="bp-bars" aria-labelledby="bars-cap" data-reveal>
      <ul>
        {INCIDENTS.map(([name, year, v, label]) => (
          <li key={name}>
            <span className="bp-bars__k">{name} <span className="mono">{year}</span></span>
            <span className="bp-bars__track"><span style={{ "--w": `${Math.max(1.2, (v / max) * 100)}%` }} /></span>
            <span className="bp-bars__v mono">{label}</span>
          </li>
        ))}
      </ul>
      <figcaption id="bars-cap">As publicly reported by the affected firms and TRM Labs. Binance's figure is the total affected.</figcaption>
    </figure>
  );
}

function FlowTrack() {
  const [tab, setTab] = useState(0);
  const flow = FLOWS[tab];
  return (
    <div className="bp-flow" data-reveal>
      <div className="tabs" role="tablist" aria-label="Example movements">
        {FLOWS.map((f, i) => (
          <button key={f.id} role="tab" type="button" aria-selected={i === tab} aria-controls="flow-panel" id={`flow-tab-${f.id}`} onClick={() => setTab(i)}>{f.label}</button>
        ))}
      </div>
      <div id="flow-panel" role="tabpanel" aria-labelledby={`flow-tab-${flow.id}`}>
        <ol className="bp-track" key={flow.id}>
          {flow.steps.map(([who, step, p], i) => (
            <li key={step} className={who.startsWith("Q²") ? "is-q" : ""} style={{ "--i": i }}>
              <span className="bp-track__dot mono" aria-hidden="true">{i + 1}</span>
              <span className="bp-track__who mono">{who}</span>
              <b>{step}</b>
              <p>{p}</p>
            </li>
          ))}
        </ol>
        <div className="bp-mrbar">
          <span><b>The Movement Record:</b> one ID from request to proof</span>
          <span className="bp-mrbar__beads" aria-hidden="true">{flow.steps.map((s, i) => <i key={i} className={i === flow.steps.length - 1 ? "is-seal" : ""} />)}</span>
          <span className="mono">Sealed so any later change shows</span>
        </div>
      </div>
      <div className="bp-notes">
        <p><span className="bp-tag bp-tag--bad">Refused</span> Fails a check? It never reaches signing. The reason is kept.</p>
        <p><span className="bp-tag">Unchanged</span> Nothing changes in how your signer signs or your books are kept.</p>
      </div>
    </div>
  );
}

function ApproveScreen() {
  return (
    <figure className="bp-screen" aria-label="Approval screen for an ordinary transfer">
      <div className="bp-screen__bar mono"><span>Q² Approve</span><span>{EXAMPLE.record}</span></div>
      <p className="bp-screen__h">Send {EXAMPLE.amount}</p>
      <dl className="bp-pins">
        <div><dt><i>1</i>Effect</dt><dd>Transfer. Control of the wallet does not change</dd></div>
        <div><dt><i>2</i>To</dt><dd>{EXAMPLE.borrower} · registered 14 Mar · paid 6 times<code>{EXAMPLE.address}</code></dd></div>
        <div><dt><i>3</i>Asked by</dt><dd>{EXAMPLE.proposer} · signed on her own key</dd></div>
        <div><dt><i>4</i>Allowed by</dt><dd>{EXAMPLE.rule}</dd></div>
        <div><dt><i>5</i>Expires</dt><dd>In 28 minutes · approval 1 of 2</dd></div>
      </dl>
      <div className="bp-screen__btns"><span className="bp-btn">Refuse</span><span className="bp-btn bp-btn--go">Approve</span></div>
      <figcaption className="mono">An ordinary transfer</figcaption>
    </figure>
  );
}

function ControlScreen() {
  return (
    <figure className="bp-screen bp-screen--warn" aria-label="Approval screen for a transaction that hands over control">
      <div className="bp-screen__bar mono"><span>Q² Approve</span><span>MR-7F3C-0002</span></div>
      <p className="bp-screen__h">Change of control</p>
      <dl className="bp-pins">
        <div><dt><i>1</i>Effect</dt><dd>Makes another contract a controller of {EXAMPLE.wallet}</dd></div>
        <div><dt><i>3</i>Asked as</dt><dd>“Routine transfer”</dd></div>
      </dl>
      <p className="bp-alert"><b aria-hidden="true">✕</b> The description does not match the decoded effect</p>
      <p className="bp-alert">Needs 3 of 4 approvers and a 72-hour delay</p>
      <div className="bp-screen__btns"><span className="bp-btn">Refuse</span><span className="bp-btn">Escalate</span></div>
      <p className="bp-screen__fine mono">No Approve button on this screen</p>
      <figcaption className="mono">A transaction that hands over control</figcaption>
    </figure>
  );
}

function CodeSample() {
  return (
    <figure className="code shell" data-reveal>
      <div className="shell__core">
        <figcaption><span>propose-and-record.ts</span><span>One loan, start to proof</span></figcaption>
        <pre tabIndex={0} aria-label="TypeScript example: propose the loan, wait for the approvals, read the sealed Movement Record"><code>
<span className="k">import</span> {"{ Q2 }"} <span className="k">from</span> <span className="s">"@q2/sdk"</span>;{"\n\n"}
<span className="k">const</span> q2 = <span className="k">new</span> Q2({"{"} apiKey: process.env.Q2_API_KEY {"}"});{"\n\n"}
<span className="c">// 1. A named person proposes. Q² checks it against the fund's rules.</span>{"\n"}
<span className="k">const</span> movement = <span className="k">await</span> q2.movements.propose({"{"}{"\n"}
{"  "}proposer: <span className="s">"j.alvarez"</span>,{"\n"}
{"  "}mandate: <span className="s">"mandate-v12"</span>,{"\n"}
{"  "}action: {"{"} type: <span className="s">"transfer"</span>, asset: <span className="s">"USDC"</span>, amount: <span className="s">"2000000"</span>, to: <span className="s">"borrower-x"</span> {"}"},{"\n"}
{"}"});{"\n\n"}
<span className="c">// 2. Two named approvers decide. The proposer cannot.</span>{"\n"}
<span className="k">const</span> decision = <span className="k">await</span> q2.decisions.wait(movement.id);{"\n\n"}
<span className="c">// 3. Your own signer signs. One sealed record comes back.</span>{"\n"}
console.log(decision.record.id);   <span className="c">// "MR-7F3A-0921"</span>{"\n"}
console.log(decision.record.seal); <span className="c">// "hybrid post-quantum (FIPS 204)"</span>
        </code></pre>
      </div>
    </figure>
  );
}

// ── Home page ─────────────────────────────────────────────────────────────
// Order follows the Website Blueprint v3 (13 Nov 2026): threat, gap, control,
// proof, belonging, permission, a safe first step.
export default function Landing({ go, enterPlatform }) {
  const root = useRef(null);
  const scrollTo = (id) => (e) => { e?.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const link = (path) => (e) => { e.preventDefault(); go(path); };

  useEffect(() => initMotion(root.current), []);

  return (
    <main id="main" ref={root} className="lp">
      {/* Hero: the buyer's own question, and the record as the visual */}
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__wash" aria-hidden="true" />
        <div className="wrap hero__grid">
          <div className="hero__in" data-hero>
            <p className="bp-kicker mono">Proof of authorisation for digital assets</p>
            <h1 id="hero-title"><span>Who approved that?</span> <span>Prove it in minutes.</span></h1>
            <p className="hero__usp">
              Q² checks every movement of your digital assets before it is signed, and seals one record of who
              approved it. You keep your keys, your signer and your administrator.
            </p>
            <div className="hero__ctas">
              <Pill href="#start" onClick={scrollTo("start")}>Book a 30-minute call</Pill>
              <Pill href="#films" onClick={scrollTo("films")} variant="ghost">See it work</Pill>
            </div>
          </div>
          <div className="hero__record" data-reveal data-reveal-delay="150"><SignedRecord /></div>
        </div>
      </section>

      {/* 01 · The problem */}
      <section className="section-x" id="problem" aria-labelledby="s01-t">
        <div className="wrap">
          <SecHead n="01" id="s01-t" title="The keys held. The authority didn't.">
            <p>The industry spent ten years making keys hard to steal, and it worked. So attackers stopped stealing keys. They got trusted systems and trusted people to sign for them.</p>
          </SecHead>
          <div className="bp-split">
            <div>
              <div className="bp-big" data-reveal>
                <p><span className="bp-big__n bp-amber">0</span><span>of nine major thefts since 2022 broke the cryptography</span></p>
                <p><span className="bp-big__n">~$10bn</span><span>affected, and every signature was valid</span></p>
              </div>
              <ul className="bp-patterns" data-reveal>
                {PATTERNS.map((p) => (
                  <li key={p.k}>
                    <b>{p.k}</b>
                    <span className="bp-chain mono"><span>{p.from}</span><i>{p.op}</i><span className="bp-chain__bad">{p.to}</span></span>
                    <p>{p.p}</p>
                  </li>
                ))}
              </ul>
            </div>
            <IncidentChart />
          </div>
          <p className="bp-quote" data-reveal>A signature proves a key was used. It does not prove a person meant it.</p>
        </div>
      </section>

      {/* 02 · The question nobody owns */}
      <section className="section-x" id="question" aria-labelledby="s02-t">
        <div className="wrap">
          <SecHead n="02" id="s02-t" title="Four questions. Three have an owner.">
            <p>Your auditor, investors and regulator ask four things about any movement. Your providers answer three from their own records. The fourth is pieced together by hand from logs, chat threads and screenshots.</p>
          </SecHead>
          <ul className="bp-four">
            {FOUR.map((f, i) => (
              <li key={f.q} className="shell" data-reveal data-reveal-delay={i * 70}><div className="shell__core"><b>{f.q}</b><p>{f.a}</p><span className="bp-owner mono">{f.who}</span></div></li>
            ))}
            <li className="shell bp-four__open" data-reveal data-reveal-delay={210}><div className="shell__core"><span className="bp-four__q" aria-hidden="true">?</span><b>Was it allowed, by the right person, before it was signed?</b><span className="bp-owner bp-owner--q mono">Q² answers this</span></div></li>
          </ul>
          <div className="bp-six" data-reveal>
            <div className="bp-six__intro">
              <h3>“Was it allowed?” is six questions.</h3>
              <p>Each one needs proof that did not come from whoever asked.</p>
            </div>
            <ol className="bp-wheel">
              <li className="bp-wheel__core" aria-hidden="true"><span>Was it allowed?</span></li>
              {SIX.map((s, i) => (
                <li key={s.q} className={`bp-wheel__q bp-wheel__q--${i + 1}`}>
                  <span className="bp-wheel__n mono">{i + 1}</span>
                  <div><b>{s.q}</b><span>{s.a}</span></div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* 03 · Check. Record. Prove. */}
      <section className="section-x" id="how" aria-labelledby="s03-t">
        <div className="wrap">
          <SecHead n="03" id="s03-t" title="Check. Record. Prove.">
            <p>One movement, start to proof. Every step adds one fact to the same record.</p>
          </SecHead>
          <FlowTrack />
        </div>
      </section>

      {/* 04 · Where it sits */}
      <section className="section-x" id="layer" aria-labelledby="s04-t">
        <div className="wrap">
          <SecHead n="04" id="s04-t" title="The layer every provider plugs into.">
            <p>Facts flow in from everyone who acts. Proof flows out to everyone who checks.</p>
          </SecHead>
          <figure className="bp-orbit" aria-labelledby="orbit-cap" data-reveal>
            <div className="bp-orbit__col">
              <p className="bp-orbit__lbl mono">Sends facts to Q²</p>
              <ul>{SENDS.map(([k, v]) => <li key={k}><b>{k}</b><span>{v}</span></li>)}</ul>
            </div>
            <div className="bp-orbit__core">
              <span className="bp-orbit__mark">Q²</span>
              <span className="mono">The authority record</span>
              <span className="bp-orbit__verbs"><i>Check</i><i>Record</i><i>Prove</i></span>
              <span className="mono bp-orbit__fine">Holds no keys · moves no money</span>
            </div>
            <div className="bp-orbit__col bp-orbit__col--out">
              <p className="bp-orbit__lbl mono">Receives proof from Q²</p>
              <ul>{RECEIVES.map(([k, v]) => <li key={k}><b>{k}</b><span>{v}</span></li>)}</ul>
            </div>
          </figure>
          <p id="orbit-cap" className="bp-after">Keep your signer, custodian, co-signer and administrator. Each already proves its own part. Q² ties those parts to the decision behind them, in one record that spans them all.</p>
        </div>
      </section>

      {/* 05 · What the approver sees */}
      <section className="section-x" id="approver" aria-labelledby="s05-t">
        <div className="wrap">
          <SecHead n="05" id="s05-t" title="People approve what will really happen.">
            <p>The approver sees the effect, decoded from the transaction itself. If control would change hands, there is no Approve button.</p>
            <p className="bp-sub">In the largest thefts, approvers acted in good faith: the screen showed one thing and the transaction did another. An approval is only worth something if the person saw what will really happen.</p>
          </SecHead>
          <div className="bp-approve" data-reveal>
            <ApproveScreen />
            <ol className="bp-pinlist">{PINS.map(([k, v], i) => <li key={k}><i className="mono">{i + 1}</i><div><b>{k}</b><span>{v}</span></div></li>)}</ol>
            <ControlScreen />
          </div>
          <p className="bp-after">Already approve on hardware wallets, security keys or passkeys? Keep them. Q² records those approvals and adds what the device cannot see: the rule that allows the movement, the source of each fact and the destination's history.</p>
        </div>
      </section>

      {/* 06 · Evidence grades */}
      <section className="section-x" id="grades" aria-labelledby="s06-t">
        <div className="wrap">
          <SecHead n="06" id="s06-t" title="A record that never proves a lie.">
            <p>A seal proves nobody changed a record afterwards. It does not make the record true. So Q² never seals a claim as true: it seals who signed what, and grades every movement by the proof behind it.</p>
          </SecHead>
          <ol className="bp-grades" data-reveal>
            {GRADES.map((g) => (
              <li key={g.g} className={`bp-grade bp-grade--${g.k}`}>
                <span className="bp-grade__g mono">Grade {g.g}</span>
                <span className="bp-grade__bar" style={{ "--w": `${g.w}%` }}><b>{g.h}</b> <span>{g.s}</span></span>
                <span className="bp-grade__not">{g.not}</span>
              </li>
            ))}
          </ol>
          <p className="bp-after">Feed the record a false claim and it says exactly that: “system-asserted, no person's proof”. It never says “approved”. Auditors already weigh evidence by its source: you can show yours the share of movements at each grade, and the trend.</p>
        </div>
      </section>

      {/* 07 · What it stops */}
      <section className="section-x" id="stops" aria-labelledby="s07-t">
        <div className="wrap">
          <SecHead n="07" id="s07-t" title="One compromise is not enough.">
            <p>Take over any single thing. The money still does not move outside your limits.</p>
          </SecHead>
          <ul className="bp-lanes" data-reveal>
            {LANES.map((l) => (
              <li key={l.k}>
                <b className="bp-lanes__k">{l.k}</b>
                <span className="bp-lanes__line" aria-hidden="true" />
                <span className={`bp-lanes__out bp-lanes__out--${l.t}`}><i aria-hidden="true">{l.t === "bad" ? "✕" : l.t === "sig" ? "⚑" : "✓"}</i><span><b>{l.out}</b>{l.why}</span></span>
              </li>
            ))}
          </ul>
          <div className="bp-big bp-big--row" data-reveal>
            <p><span className="bp-big__n">9</span><span>breach attempts run in every pilot, each refused with a reason</span></p>
            <p><span className="bp-big__n">0</span><span>ways to override a refusal</span></p>
          </div>
          <p className="bp-after">What no system can do is stop people with real authority agreeing to do the wrong thing. Limits bound the damage, and the record proves who decided.</p>
        </div>
      </section>

      {/* 08 · Who it is for */}
      <section className="section-x" id="who" aria-labelledby="s08-t">
        <div className="wrap">
          <SecHead n="08" id="s08-t" title="Who it is for.">
            <p>Anyone who moves digital assets and has to show someone else it was allowed.</p>
          </SecHead>
          <ul className="bp-sectors">
            {SECTORS.map((s, i) => (
              <li key={s.h} className="shell" data-reveal data-reveal-delay={i * 60} onPointerMove={spotlight}>
                <div className="shell__core">
                  <h3>{s.h}</h3>
                  <p>{s.p}</p>
                  {s.to && <a className="bp-more mono" href={s.to} onClick={link(s.to)}>{s.cta} <Arrow /></a>}
                </div>
              </li>
            ))}
          </ul>
          <p className="bp-after"><b>Where Q² adds little:</b> one custodian holds everything, there are a handful of movements a year, and your auditor is satisfied. We say so on the first call.</p>
        </div>
      </section>

      {/* 09 · Capabilities */}
      <section className="section-x" id="capabilities" aria-labelledby="s09-t">
        <div className="wrap">
          <SecHead n="09" id="s09-t" title="One base. Add what you need.">
            <p>Everything attaches to the same record. Cloud, in-region or on-premise.</p>
          </SecHead>
          <div className="bp-stack" data-reveal>
            <div className="bp-stack__row">
              <p className="bp-stack__lbl"><span className="mono">Add-ons</span><b>Chosen separately</b></p>
              <ul className="bp-stack__addons">{ADDONS.map(([k, v]) => <li key={k}><b>{k}</b><span>{v}</span></li>)}</ul>
            </div>
            <div className="bp-stack__row">
              <p className="bp-stack__lbl"><span className="mono">Base</span><b>Your own rules</b></p>
              <ul className="bp-chips">{BASE_RULES.map((k) => <li key={k}>{k}</li>)}</ul>
            </div>
            <div className="bp-stack__row bp-stack__row--core">
              <p className="bp-stack__lbl"><span className="mono">Base</span><b>Evidence foundation</b></p>
              <ul className="bp-chips">{BASE_EVIDENCE.map((k) => <li key={k}>{k}</li>)}</ul>
            </div>
          </div>
        </div>
      </section>

      {/* 10 · Why now */}
      <section className="section-x" id="regulation" aria-labelledby="s10-t">
        <div className="wrap">
          <SecHead n="10" id="s10-t" title="Every shift in finance produced a proof.">
            <p>Proof of reserves showed the assets exist. Proof of authorisation shows every movement was allowed.</p>
          </SecHead>
          <ol className="bp-timeline" data-reveal>
            {TIMELINE.map(([y, h, s]) => (
              <li key={y} className={y === "Now" ? "is-now" : ""}><span className="mono">{y}</span><b>{h}</b>{(y === "2022" || y === "Now") && <span>{s}</span>}</li>
            ))}
          </ol>
          <h3 className="bp-h3" data-reveal>The rules already ask for this evidence.</h3>
          <ul className="bp-rules" data-reveal>
            {HOME_RULES.map((r) => (
              <li key={r.where}>
                <span className="mono bp-rules__where">{r.where}<br />{r.when}</span>
                <span className="bp-rules__q">“{r.quote}”{r.post || ""}</span>
                <span className="bp-rules__gives"><Arrow /> {r.gives}</span>
              </li>
            ))}
          </ul>
          <p className="bp-fine">Q² supports your compliance work. Using it does not by itself make a firm compliant. <a href="/regulation" onClick={link("/regulation")}>Read the rules in full</a>.</p>
        </div>
      </section>

      {/* 11 · Films */}
      <section className="section-x" id="films" aria-labelledby="s11-t">
        <div className="wrap">
          <SecHead n="11" id="s11-t" title="Watch it work.">
            <p>One loan, followed start to proof. Then ten films of about a minute, one claim each.</p>
          </SecHead>
          <a className="bp-feature" href="/demo" onClick={link("/demo")} data-reveal>
            <span className="bp-play" aria-hidden="true"><svg viewBox="0 0 16 16" width="16" height="16"><path d="M5 3.5v9l7.5-4.5z" fill="currentColor" /></svg></span>
            <span className="bp-feature__t"><b>One loan, start to proof</b><span className="mono">All ten films · about 10 min</span></span>
            <span className="bp-feature__steps mono" aria-hidden="true">{["Request", "Check", "Approve", "Sign", "Settle", "Book", "Prove"].map((s, i) => <i key={s} className={i === 6 ? "is-seal" : ""}>{s}</i>)}</span>
          </a>
          <ul className="bp-films">
            {FILMS.map((f, i) => (
              <li key={f.n} data-reveal data-reveal-delay={(i % 5) * 50}>
                <a href={`/demo?film=${f.n}`} onClick={link(`/demo?film=${f.n}`)}>
                  <span className="bp-films__still" aria-hidden="true"><span className="mono">{f.n}</span><span className="bp-films__q">“{f.question}”</span><span className="bp-films__thread" /></span>
                  <b>{f.title}</b>
                  <span className="mono">{f.dur}</span>
                </a>
              </li>
            ))}
          </ul>
          <p className="bp-after"><a href="/whitepaper" onClick={link("/whitepaper")}>Prefer to read? The whitepaper covers every section in depth</a></p>
        </div>
      </section>

      {/* 12 · Limits and quantum */}
      <section className="section-x" id="never" aria-labelledby="s12-t">
        <div className="wrap">
          <SecHead n="12" id="s12-t" title="What Q² never does.">
            <p>That is why compromising Q² moves no money. It does not replace your policy engine, co-signer or monitoring, and it cannot recall a transfer that has settled.</p>
          </SecHead>
          <ul className="bp-never" data-reveal>{NEVER.map((k) => <li key={k}><i aria-hidden="true">✕</i>{k}</li>)}</ul>
          <div className="bp-quantum shell" data-reveal>
            <div className="shell__core">
              <div>
                <p className="mono bp-quantum__k">Looking for quantum resilience?</p>
                <h3>Your records are sealed for it today. Your assets can be too.</h3>
              </div>
              <div>
                <p>Every Q² record carries a hybrid classical and post-quantum seal, so it stays verifiable for as long as you keep it.</p>
                <p>If you also want quantum resilience for the assets themselves, Q² offers accounts you control: approvals checked with post-quantum signatures, and a fresh signing key for every transaction so no public key sits exposed.</p>
                <p>One risk stays with every provider until the networks upgrade their own signatures. We show you exactly where it sits. <a href="#start" onClick={scrollTo("start")}>Ask us.</a></p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 13 · Getting started */}
      <section className="section-x" id="steps" aria-labelledby="s13-t">
        <div className="wrap">
          <SecHead n="13" id="s13-t" title="Start small. Pass on evidence.">
            <p>Each step is priced so you can stop after it. <a href="/pricing" onClick={link("/pricing")}>See pricing</a>.</p>
          </SecHead>
          <ol className="bp-ladder" data-reveal>
            {LADDER.map((s) => (
              <li key={s.n}><span className="bp-ladder__n mono">{s.n}</span><b>{s.h}</b><span className="mono bp-ladder__meta">{s.meta}</span><p>{s.p}</p></li>
            ))}
          </ol>
          <h3 className="bp-h3" data-reveal>How we both know the pilot worked.</h3>
          <ul className="bp-criteria" data-reveal>{CRITERIA.map(([k, v]) => <li key={k} title={v}><i aria-hidden="true">✓</i><b>{k}</b></li>)}</ul>
        </div>
      </section>

      {/* 14 · FAQ */}
      <section className="section-x" id="faq" aria-labelledby="s14-t">
        <div className="wrap">
          <SecHead n="14" id="s14-t" title="Asked first." />
          <dl className="bp-faq" data-reveal>
            {FAQ.slice(0, 3).map(([q, a]) => <div key={q}><dt>{q}</dt><dd>{a}</dd></div>)}
          </dl>
          <p className="bp-after"><a href="/whitepaper#s15" onClick={link("/whitepaper#s15")}>More questions answered in the whitepaper</a></p>
        </div>
      </section>

      {/* Developers */}
      <section className="section-x" id="developers" aria-labelledby="dev-title">
        <div className="wrap dev">
          <div data-reveal>
            <div className="head" style={{ marginBottom: 0 }}>
              <h2 id="dev-title">One call to propose. One record back.</h2>
              <p>For developers: propose a movement from any system, get a named decision, and read back the sealed record.</p>
            </div>
            <ul className="dev__list">
              <li>Propose from any system, person or agent inside a mandate.</li>
              <li>Named approvers decide. The proposer and agents never approve.</li>
              <li>Your own signer signs; the record comes back to store, share or verify.</li>
            </ul>
            <div style={{ marginTop: "var(--space-8)" }}><Pill href="/docs" onClick={link("/docs")} variant="ghost">Read the developer docs</Pill></div>
          </div>
          <CodeSample />
        </div>
      </section>

      {/* Closing band */}
      <section className="closing" id="start" aria-labelledby="start-title">
        <Atom3D className="closing__atom" compact label="A diagram of an atom" />
        <div className="wrap">
          <div className="closing__head" data-reveal>
            <h2 id="start-title">You hold the keys. Q² proves every decision made with them.</h2>
            <p>Bring one movement and your hardest question. In 30 minutes we map it to the six questions, free. Or write to <a href="mailto:info@quantumqustody.com">info@quantumqustody.com</a>.</p>
          </div>
          <div className="dp">
            <div data-reveal>
              <ol className="ladder">
                {LADDER.slice(0, 3).map((s) => <li key={s.n}><span className="mono">0{s.n}</span><div><h3>{s.h} <b>{s.meta}</b></h3><p>{s.p}</p></div></li>)}
              </ol>
              <p className="ladder__more"><a href="/demo" onClick={link("/demo")}>Watch the demo films</a> · <a href="/whitepaper" onClick={link("/whitepaper")}>Read the whitepaper</a> · <a href="/" onClick={(e) => { e.preventDefault(); enterPlatform("auth"); }}>Sign in</a></p>
            </div>
            <div className="shell" data-reveal data-reveal-delay="100"><div className="shell__core shell__core--form"><EnquiryForm onPartnerSignIn={link("/design-partner")} /></div></div>
          </div>
        </div>
      </section>
    </main>
  );
}
