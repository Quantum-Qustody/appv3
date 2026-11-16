import { useEffect, useRef } from "react";
import { Pill, SecHead } from "./Landing.jsx";
import { initMotion } from "./motion.js";

// /igaming — for iGaming operators and crypto payment providers.
// Source: Q² Website Blueprint v3, "iGaming page" (13 Nov 2026).
// Regulatory summaries are for orientation only.

const DATES = [
  ["Dec 2026", "Curaçao: first controls due", "Risk assessments, provider diligence, wallet-ownership controls"],
  ["Jun 2027", "Curaçao: full compliance", "The crypto guideline applies in full"],
  ["10 Jul 2027", "EU AML Regulation applies", "Records kept five years, unaltered"],
];

const BREAKS = [
  ["A payout with no player behind it", "Bound to a verified withdrawal", "Anything else is flagged as it settles"],
  ["A payout to the wrong address", "Approved and settled destinations matched", ""],
  ["A withdrawal refused with no evidence", "A sealed refusal", "Reason, reviewer and time, ready for the report"],
  ["Treasury moves between hot, warm and cold", "Tied to a mandate and two approvers", ""],
  ["A whitelist or permission change", "Who, when, before and after", "Change-then-use by one person is flagged"],
  ["An approval made in chat or on a call", "Does not count", "Only an approval bound to amount and destination does"],
  ["A balance that does not reconcile", "Seen on the day", "Every outflow reconciled to its authority"],
];

const RULES = [
  ["Curaçao", "crypto guideline", "Multi-signature approval and withdrawal whitelisting", "Named approvers bound to each transfer"],
  ["Curaçao", "crypto guideline", "Withdrawals only to the depositing or a verified wallet of the same player", "Destinations matched, payout by payout"],
  ["Malta · MGA", "DLT policy", "Refusals only on anti-money-laundering grounds, and reported", "Sealed refusal records with reasons"],
  ["EU · AML Regulation", "Art. 77", "Records kept five years, unaltered and admissible", "Records sealed to stay verifiable"],
];

const PHASES = [
  ["1", "Before", "Prove the origin", "Every payout carries its player's verified withdrawal, so the wallet never signs on a service's word alone."],
  ["2", "During", "See it as it happens", "An outflow with nothing behind it is flagged as it settles."],
  ["3", "After", "Prove what was authorised", "To the regulator, the payment partner, the insurer and players."],
];

export default function IGamingPage({ go }) {
  const root = useRef(null);
  useEffect(() => initMotion(root.current), []);
  const link = (p) => (e) => { e.preventDefault(); go(p); };

  return (
    <main id="main" ref={root} className="lp page">
      <section className="bp-page-hero" aria-labelledby="ig-title">
        <div className="wrap">
          <p className="bp-kicker mono">For iGaming operators and crypto payment providers</p>
          <h1 id="ig-title">Every payout authorised. Every authorisation provable.</h1>
          <p className="bp-lede">Payouts must be fast, so a payout service decides what your hot wallet signs. Q² proves a player and your own rules were behind every one.</p>
          <ul className="bp-roles" aria-label="Who does what">
            <li><b>Player</b><span>requests</span></li><li className="bp-roles__sep" aria-hidden="true">→</li>
            <li><b>Operator</b><span>approves</span></li><li className="bp-roles__sep" aria-hidden="true">→</li>
            <li><b>Wallet</b><span>signs</span></li><li className="bp-roles__sep" aria-hidden="true">→</li>
            <li><b>Chain</b><span>settles</span></li><li className="bp-roles__sep" aria-hidden="true">·</li>
            <li className="is-q"><b>Q²</b><span>proves the authority</span></li>
          </ul>
          <div className="hero__ctas"><Pill href="/#start" onClick={link("/#start")}>Book a 30-minute call</Pill><Pill href="/demo" onClick={link("/demo")} variant="ghost">Watch the films</Pill></div>
        </div>
      </section>

      <section className="section-x" aria-labelledby="g01">
        <div className="wrap">
          <SecHead n="01" id="g01" title="The dates are set.">
            <p>Licensing and anti-money-laundering rules now ask who controls each wallet, who approved each transfer and what was refused.</p>
          </SecHead>
          <ul className="bp-dates" data-reveal>{DATES.map(([d, h, p]) => <li key={d}><span className="mono">{d}</span><b>{h}</b><span>{p}</span></li>)}</ul>
          <div className="bp-big bp-big--row" data-reveal>
            <p><span className="bp-big__n">4.5×</span><span>rise in suspicious iGaming transactions in a year (Sumsub, June 2026)</span></p>
            <p><span className="bp-big__n">$8.7bn</span><span>stolen in crypto hacks in 2026 to 29 October (TRM Labs)</span></p>
          </div>
        </div>
      </section>

      <section className="section-x" aria-labelledby="g02">
        <div className="wrap">
          <SecHead n="02" id="g02" title="Seven places proof breaks.">
            <p>Payouts are automated because they must be fast. That puts a service, not a person, in front of the hot wallet, and a service believes whatever reaches it. So the question is never “was it signed?”. It is “who allowed it?”.</p>
          </SecHead>
          <div className="bp-table-wrap" data-reveal>
            <table className="bp-table">
              <thead><tr><th scope="col">Where proof breaks</th><th scope="col">With Q²</th><th scope="col">And</th></tr></thead>
              <tbody>{BREAKS.map(([k, w, a]) => <tr key={k}><td>{k}</td><td className="is-q">{w}</td><td>{a}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section-x" aria-labelledby="g03">
        <div className="wrap">
          <SecHead n="03" id="g03" title="What the rules ask for. What the record gives." />
          <ul className="bp-rules" data-reveal>
            {RULES.map(([w, c, q, g]) => (
              <li key={q}><span className="mono bp-rules__where">{w}<br />{c}</span><span className="bp-rules__q">{q}</span><span className="bp-rules__gives">→ {g}</span></li>
            ))}
          </ul>
          <p className="bp-fine">Regulatory summaries are for orientation. Q² supports compliance evidence; it does not confer compliance.</p>
          <p className="bp-after">None of these rules asks for a new wallet. Each asks for evidence, payout by payout, that your controls ran.</p>
        </div>
      </section>

      <section className="section-x" aria-labelledby="g04">
        <div className="wrap">
          <SecHead n="04" id="g04" title="Before, during and after.">
            <p>In October an exchange reported $6.34bn affected after its signing service believed what it was told. A payout service is the same shape, smaller.</p>
          </SecHead>
          <ol className="bp-ladder" data-reveal style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            {PHASES.map(([n, h, m, p]) => <li key={n}><span className="bp-ladder__n mono">{n}</span><b>{h}</b><span className="mono bp-ladder__meta">{m}</span><p>{p}</p></li>)}
          </ol>
          <ul className="bp-never" data-reveal style={{ marginTop: "var(--space-12)" }}>{["Hold keys", "Sign payouts", "Move player funds", "See player identity data", "Audit or certify"].map((k) => <li key={k}><i aria-hidden="true">✕</i>{k}</li>)}</ul>
          <p className="bp-after">Q² works on references your systems already hold. Player identity data never reaches it, and nothing changes in how your wallet signs.</p>
          <p className="bp-after"><a href="/whitepaper#s12" onClick={link("/whitepaper#s12")}>The detail, section by section: read the whitepaper</a></p>
        </div>
      </section>

      <section className="bp-cta-band" aria-labelledby="g-cta">
        <div className="wrap">
          <h2 id="g-cta">Who approved that payout? Prove it in minutes.</h2>
          <p>Start with a 30-minute call, then a diagnostic against your licence conditions.</p>
          <div className="hero__ctas"><Pill href="/#start" onClick={link("/#start")}>Book a 30-minute call</Pill><Pill href="mailto:info@quantumqustody.com" variant="ghost">info@quantumqustody.com</Pill></div>
          <p className="bp-fine">Sources: Curaçao Gaming Authority crypto policy guideline (2026); MGA policy on the use of DLT; Regulation (EU) 2024/1624; Sumsub (June 2026); TRM Labs (30 October 2026); Binance findings (3 November 2026).</p>
        </div>
      </section>
    </main>
  );
}
