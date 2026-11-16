import { useEffect, useRef } from "react";
import { Pill, SecHead } from "./Landing.jsx";
import { initMotion } from "./motion.js";
import { NINE } from "./content.js";

// /funds — for funds, administrators and transfer agents.
// Source: Q² Website Blueprint v3, "Funds page" (13 Nov 2026).

const SIX_TODAY = [
  ["Who asked?", "A message in chat", "A named person, or a mandate they signed"],
  ["Were they allowed?", "Whoever has admin rights", "Rule changes need two people and a wait"],
  ["Did they see the real effect?", "Whatever the screen shows", "Decoded from the transaction itself"],
  ["Were the facts true?", "Limits checked by eye", "Checked on the administrator's NAV"],
  ["Was it checked before signing?", "The signer's own policy only", "The fund's rules too, ahead of the signer"],
  ["How fast is it seen and proven?", "Hours, from logs and screenshots", "One sealed export, in minutes"],
];

const AROUND = [
  ["Manager", "Decides and approves", "Proof of its own oversight"],
  ["Risk function", "Sets the limits", "Limits checked on every movement"],
  ["Signer", "Holds keys, signs", "Its policy result on the record"],
  ["Administrator", "Books and reconciles", "The authorisation, with the entry"],
  ["Transfer agent", "Keeps the register", "Sweeps only after acceptance"],
  ["Depositary", "Oversees the assets", "Movements matched to instructions"],
  ["Auditor", "Tests the controls", "One export per sample"],
  ["Investors", "Ask who can move money", "A rule was followed, positions unseen"],
];

const ADMIN = [
  ["Subscription sweep", "Moves only after the money is matched, screened and accepted", "The acceptance, on the record"],
  ["Redemption", "Paid to the holder's registered account, after NAV is struck", "Destination and amount matched"],
  ["Distribution", "Matches the approved calculation, holder by holder", "Who approved the run"],
  ["Fees", "Inside the fund's terms, never approved by the payee", "Separation of duties, shown"],
];

const WEEKS = [
  ["1", "Connect", "Week 1", "Your signer and administrator, read-only."],
  ["2", "Refuse", "Week 2", "The nine breach attempts, each refused."],
  ["3", "Approve and match", "Week 3", "Approvals bound to what is signed, settled and booked."],
  ["4", "Prove", "Week 4", "Results against seven written criteria."],
];

export default function FundsPage({ go }) {
  const root = useRef(null);
  useEffect(() => initMotion(root.current), []);
  const link = (p) => (e) => { e.preventDefault(); go(p); };

  return (
    <main id="main" ref={root} className="lp page">
      <section className="bp-page-hero" aria-labelledby="funds-title">
        <div className="wrap">
          <p className="bp-kicker mono">For funds, administrators and transfer agents</p>
          <h1 id="funds-title">Every movement authorised. Every authorisation provable.</h1>
          <p className="bp-lede">Your signer proves it signed. Your administrator proves it booked. Q² proves the fund allowed it, before the money moved.</p>
          <ul className="bp-roles" aria-label="Who does what">
            <li><b>Fund</b><span>authorises</span></li><li className="bp-roles__sep" aria-hidden="true">→</li>
            <li><b>Signer</b><span>signs</span></li><li className="bp-roles__sep" aria-hidden="true">→</li>
            <li><b>Chain</b><span>settles</span></li><li className="bp-roles__sep" aria-hidden="true">→</li>
            <li><b>Administrator</b><span>records</span></li><li className="bp-roles__sep" aria-hidden="true">·</li>
            <li className="is-q"><b>Q²</b><span>proves permission</span></li>
          </ul>
          <div className="hero__ctas"><Pill href="/#start" onClick={link("/#start")}>Book a 30-minute call</Pill><Pill href="/demo" onClick={link("/demo")} variant="ghost">Watch the films</Pill></div>
        </div>
      </section>

      <section className="section-x" aria-labelledby="f01">
        <div className="wrap">
          <SecHead n="01" id="f01" title="Six questions, today and with Q².">
            <p>What an auditor or an investor's diligence team asks about one movement. Today the answers are assembled by hand. With Q², they arrive in one record.</p>
          </SecHead>
          <div className="bp-table-wrap" data-reveal>
            <table className="bp-table">
              <thead><tr><th scope="col">Question</th><th scope="col">Today</th><th scope="col">With Q²</th></tr></thead>
              <tbody>{SIX_TODAY.map(([q, t, w]) => <tr key={q}><td>{q}</td><td className="is-today">{t}</td><td className="is-q">{w}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section-x" aria-labelledby="f02">
        <div className="wrap">
          <SecHead n="02" id="f02" title="Everyone around a movement gets something.">
            <p>Nobody's role changes. Each receives proof they could not produce alone.</p>
          </SecHead>
          <ul className="bp-cards" data-reveal>{AROUND.map(([k, r, g]) => <li key={k}><b>{k}</b><span>{r}</span><span className="bp-gets">{g}</span></li>)}</ul>
          <p className="bp-after">Is there a gap worth mapping? Usually yes if more than one provider sits between the decision and the ledger, if your limits depend on figures your signer cannot see, or if an auditor or investor has asked who approved a movement.</p>
        </div>
      </section>

      <section className="section-x" aria-labelledby="f03">
        <div className="wrap">
          <SecHead n="03" id="f03" title="Nine things that do not get through.">
            <p>Built first in every pilot. Each breach is attempted on purpose, and each must be refused with a reason code and an alert. None can be overridden.</p>
          </SecHead>
          <ul className="bp-nine" data-reveal>{NINE.map((k) => <li key={k}>{k}</li>)}</ul>
        </div>
      </section>

      <section className="section-x" aria-labelledby="f04">
        <div className="wrap">
          <SecHead n="04" id="f04" title="For administrators and transfer agents.">
            <p>You reconcile what moved, then are asked to evidence an authorisation you never saw. With Q², the authorisation arrives with the transaction: a service you can offer every fund you administer.</p>
          </SecHead>
          <div className="bp-table-wrap" data-reveal>
            <table className="bp-table">
              <thead><tr><th scope="col">Flow</th><th scope="col">The rule</th><th scope="col">On the record</th></tr></thead>
              <tbody>{ADMIN.map(([k, r, g]) => <tr key={k}><td>{k}</td><td>{r}</td><td className="is-q">{g}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section-x" aria-labelledby="f05">
        <div className="wrap">
          <SecHead n="05" id="f05" title="A pilot in four weeks.">
            <p>One real flow, beside the signer and administrator you already use. Results are scored against seven criteria agreed in writing before it starts.</p>
          </SecHead>
          <ol className="bp-ladder" data-reveal>
            {WEEKS.map(([n, h, w, p]) => <li key={n}><span className="bp-ladder__n mono">{n}</span><b>{h}</b><span className="mono bp-ladder__meta">{w}</span><p>{p}</p></li>)}
          </ol>
          <p className="bp-after"><a href="/whitepaper#s13" onClick={link("/whitepaper#s13")}>The detail, section by section: read the whitepaper</a></p>
        </div>
      </section>

      <section className="bp-cta-band" aria-labelledby="f-cta">
        <div className="wrap">
          <h2 id="f-cta">Who approved that? Prove it in minutes.</h2>
          <p>Bring one fund flow. We map it to the six questions in 30 minutes.</p>
          <div className="hero__ctas"><Pill href="/#start" onClick={link("/#start")}>Book a 30-minute call</Pill><Pill href="mailto:info@quantumqustody.com" variant="ghost">info@quantumqustody.com</Pill></div>
          <p className="bp-fine">Q² supports your compliance work. It does not audit, attest or certify.</p>
        </div>
      </section>
    </main>
  );
}
