import { useEffect, useRef } from "react";
import { RULES, PERIODS, LANES } from "./rules.js";
import { Pill } from "./Landing.jsx";
import { initMotion } from "./motion.js";

// The regulation page from the website review of 13 Oct 2026, section 5:
// the rules in their own words, what Q² gives you, where the rules are heading.

const QUANTUM = [
  ["DORA", "requires cryptography to be updated as cryptanalysis develops, and names quantum in Recital 9 of the ICT risk standard."],
  ["NIS2, Art. 21(2)(h)", "requires “policies and procedures regarding the use of cryptography”. DORA takes precedence for financial entities."],
  ["EO 14412 and OMB M-26-15", "bind US federal agencies: key establishment by 2030, signatures by 2031, full migration by 2035."],
  ["EU coordinated roadmap", "(non-binding) asks for high-risk use cases on post-quantum “no later than by the end of 2030”."],
  ["G7 Cyber Expert Group", "(non-binding) asks financial firms to inventory their cryptography, prioritising critical systems for 2030 to 2032."],
];

export default function RegulationPage({ go }) {
  const root = useRef(null);
  useEffect(() => initMotion(root.current), []);

  return (
    <main id="main" ref={root} className="lp page">
      <section className="section-x page__top" aria-labelledby="reg-page-title">
        <div className="wrap">
          <div className="head" data-reveal>
            <h1 id="reg-page-title">Regulation already asks for this evidence.</h1>
            <p>Records that cannot be altered, every instruction including rejected ones, named approvers, two-person authorisation and cryptography that can be updated. Here is what each rule says, in its own words, next to what Q² produces.</p>
          </div>

          <ul className="rulegrid">
            {RULES.map((r, i) => (
              <li key={r.id} className="rulecard" data-reveal data-reveal-delay={(i % 2) * 80}>
                <div className="rulecard__top">
                  <span className={`rstatus rstatus--${r.status.toLowerCase()}`}>{r.status}</span>
                  <a className="mono rulecard__cite" href={r.url} target="_blank" rel="noopener noreferrer">{r.cite}</a>
                </div>
                <h2>{r.rule}</h2>
                <blockquote>“{r.quote}”</blockquote>
                <p className="rulecard__gives"><span>What Q² gives you</span>{r.gives}</p>
                <p className="rulecard__binds">{r.binds}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section-x" aria-labelledby="ondemand-title">
        <div className="wrap">
          <div className="ondemand" data-reveal>
            <h2 id="ondemand-title">On demand, not reconciled.</h2>
            <p>Supervisors and auditors ask for evidence that should already exist. Q² writes it as each decision is made, so the evidence pack for an audit or examination is generated, not rebuilt from logs, spreadsheets and chat.</p>
          </div>
        </div>
      </section>

      <section className="section-x" aria-labelledby="quantum-title">
        <div className="wrap">
          <div className="head" data-reveal>
            <h2 id="quantum-title">What existing rules say about quantum.</h2>
            <p>No rule yet requires private financial firms to use post-quantum cryptography. The duty to keep cryptography up to date exists now, and the dated mandates are arriving for government first and finance next.</p>
          </div>
          <dl className="qlist" data-reveal>
            {QUANTUM.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </div>
      </section>

      <section className="section-x" aria-labelledby="heading-title">
        <div className="wrap">
          <div className="head" data-reveal>
            <h2 id="heading-title">Where the rules are heading.</h2>
            <p>Read across a row to see one area tightening. The shaded column is what already applies. Only rules that bear on approval, record keeping or cryptography are shown.</p>
          </div>
          <div className="lanes" role="table" aria-label="Regulatory timeline by area and period" data-reveal>
            <div className="lanes__row lanes__row--head" role="row">
              <div role="columnheader"><span className="sr-only">Area</span></div>
              {PERIODS.map((p, i) => <div key={p} role="columnheader" className={i === 0 ? "is-now" : ""}>{p}</div>)}
            </div>
            {LANES.map((l) => (
              <div key={l.name} className="lanes__row" role="row">
                <div role="rowheader" className="lanes__name">{l.name}</div>
                {l.cells.map((c, i) => (
                  <div key={i} role="cell" className={i === 0 ? "is-now" : ""}>
                    {c.length ? <ul>{c.map((t) => <li key={t}>{t}</li>)}</ul> : <span className="lanes__empty" aria-label="Nothing yet">·</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <p className="diagram__note">The GENIUS Act covers payment-stablecoin issuers, and the CLARITY Act failed its Senate vote on 15 Sep 2026, so neither sets approval or record duties for these buyers. OCC custody letters apply to national banks.</p>
          <p className="rules__note" style={{ marginTop: "var(--space-8)" }}>Q² supports your compliance work. It does not replace legal advice, and using it does not by itself make a firm compliant.</p>
          <div style={{ marginTop: "var(--space-8)" }}><Pill href="/#start" onClick={(e) => { e.preventDefault(); go("/#start"); }}>Book a 30-minute diagnostic call</Pill></div>
        </div>
      </section>
    </main>
  );
}
