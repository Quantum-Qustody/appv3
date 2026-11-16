import { useEffect, useState } from "react";
import { Pill } from "./Landing.jsx";
import { EXAMPLE } from "./filmsList.js";
import { INCIDENTS, PATTERNS, FOUR, SIX, GRADES, LANES, NINE, LADDER, CRITERIA, FAQ, TIMELINE, NEVER } from "./content.js";

// /whitepaper — "Proof of authorisation", Whitepaper v1.0 (Chee Yang Ng, Nov 2026).
// Same words, figures and example as the home page. Each section has its own
// anchor (s01..s16) so a single section can be sent as a link. The PDF beside
// it is the version Chee circulated on 13 Nov 2026.

export const PDF = "/q2-proof-of-authorisation-whitepaper.pdf";

const TOC = [
  ["01", "The problem", "The keys held. The authority didn't"],
  ["02", "The question nobody owns", "Four questions, and the six inside the fourth"],
  ["03", "What Q² is", "Check, record, prove; where it sits; what it never does"],
  ["04", "One movement, start to proof", "Seven steps and the Movement Record"],
  ["05", "What the approver sees", "The real effect, not a description"],
  ["06", "Evidence grades", "A record that never proves a lie"],
  ["07", "What Q² stops, and what it flags", "Nine refusals and the single-compromise test"],
  ["08", "Working with what you already run", "What each existing control proves and leaves open"],
  ["09", "Capabilities and deployment", "One base, optional add-ons, your data"],
  ["10", "Why now", "Four forces, and the rules in their own words"],
  ["11", "Quantum resilience", "Records today, assets as an option, the risk that stays"],
  ["12", "By sector", "Funds, administrators, tokenisation, iGaming, agents"],
  ["13", "Getting started", "Four priced steps and seven pass criteria"],
  ["14", "Limits", "What Q² does not do"],
  ["15", "Questions asked first", "Eight short answers"],
  ["16", "Glossary and sources", "Terms used here, and where the figures come from"],
];

function Table({ head, rows, qCol }) {
  return (
    <div className="bp-table-wrap">
      <table className="bp-table">
        <thead><tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j === qCol ? "is-q" : ""}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function Sec({ n, title, children }) {
  return (
    <section className="wp__sec" id={`s${n}`} aria-labelledby={`s${n}-t`}>
      <span className="bp-n mono">{n}</span>
      <h2 id={`s${n}-t`}>{title}</h2>
      {children}
    </section>
  );
}

export default function WhitepaperPage({ go }) {
  const [active, setActive] = useState("01");
  const film = (n, label) => <a className="wp__film" href={`/demo?film=${n}`} onClick={(e) => { e.preventDefault(); go(`/demo?film=${n}`); }}>Film {n} · {label}</a>;

  useEffect(() => {
    const els = TOC.map(([n]) => document.getElementById(`s${n}`)).filter(Boolean);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id.slice(1)); });
    }, { rootMargin: "-20% 0px -70% 0px" });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const jump = (n) => (e) => { e.preventDefault(); document.getElementById(`s${n}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); history.replaceState({}, "", `#s${n}`); };

  return (
    <main id="main" className="lp page">
      <section className="bp-page-hero" aria-labelledby="wp-title">
        <div className="wrap">
          <p className="bp-kicker mono">Whitepaper · Version 1.0 · November 2026</p>
          <h1 id="wp-title">Proof of authorisation</h1>
          <p className="bp-lede">How Q² checks, records and proves every movement of digital assets, while you keep your keys, your signer and your administrator.</p>
          <div className="wp__meta"><span>16 sections</span><span>About 25 minutes to read</span><span>For risk, operations, compliance and audit teams</span></div>
          <div className="hero__ctas"><Pill href={PDF}>Download PDF</Pill><Pill href="/#start" onClick={(e) => { e.preventDefault(); go("/#start"); }} variant="ghost">Book a 30-minute call</Pill></div>
        </div>
      </section>

      <div className="wrap wp">
        <nav className="wp__toc" aria-label="Contents">
          <p>Contents</p>
          <ol>{TOC.map(([n, t]) => <li key={n}><a href={`#s${n}`} onClick={jump(n)} aria-current={active === n ? "true" : undefined}><span className="mono">{n}</span>{t}</a></li>)}</ol>
        </nav>

        <article className="wp__body">
          <section className="wp__sec" aria-labelledby="brief-t">
            <h2 id="brief-t">In brief</h2>
            <ul className="wp__brief">
              <li><b>The keys held. The authority didn't.</b><span>Nine major thefts since 2022 affected about $10bn. None broke the cryptography. Trusted systems and deceived people produced valid signatures.</span></li>
              <li><b>Each of your tools proves its own part. Nobody proves the movement was allowed.</b><span>Your signer proves its policy was met, the chain proves what settled, your administrator proves the books. Proof that the right person approved this exact movement, under your rules, before it was signed, is assembled by hand.</span></li>
              <li><b>Q² checks, records and proves. It holds no keys.</b><span>One record per movement, from the decision to the ledger entry, across every provider. What fails a check is refused, with a reason.</span></li>
              <li><b>The record never proves a lie.</b><span>Every movement is graded by the proof behind it. A system's word alone is never recorded as an approval.</span></li>
              <li><b>Start small, pass on evidence.</b><span>A 30-minute call, a fixed-fee diagnostic, then a four-week pilot with seven written pass criteria.</span></li>
            </ul>
            <p className="wp__callout">Your signer proves a key was used. Q² proves a person entitled to decide approved that exact movement, under your rules, before it was signed, and gives your auditor one record to check.</p>
          </section>

          <Sec n="01" title="The problem: the keys held, the authority didn't">
            <p>The industry spent ten years making keys hard to steal: hardware modules, multi-party computation, multi-signature wallets, cold storage. It worked. So attackers stopped stealing keys. They got trusted systems, and trusted people, to sign for them. In each of the incidents below, every signature was valid.</p>
            <div className="bp-big bp-big--row" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
              <p><span className="bp-big__n bp-amber">0</span><span>of nine major thefts since 2022 broke the cryptography</span></p>
              <p><span className="bp-big__n">~$10bn</span><span>affected, and every signature was valid</span></p>
              <p><span className="bp-big__n">6 of 9</span><span>involved a change of control</span></p>
            </div>
            <Table head={["Firm", "Year", "Affected"]} rows={INCIDENTS.map(([n, y, , l]) => [n, y, l])} />
            <p>Six of the nine involved a change of control: a delegation, a contract upgrade, a new administrator or a change to an allow-list. These are the transactions an approver is least able to read on a screen, and the ones that hand over the most.</p>
            <h3>Three patterns, repeated</h3>
            <Table head={["Pattern", "What happens", "What closes it"]} rows={PATTERNS.map((p) => [p.k, p.p, p.fix])} qCol={2} />
            <p className="wp__callout">A signature proves a key was used. It does not prove a person meant it.</p>
            <p className="bp-fine">Losses as publicly reported by the affected firms, TRM Labs and news coverage. Binance's figure is the total affected in its findings of 3 November 2026, of which about $2.85bn was frozen or intercepted. Bitget's is its revised total. These nine were chosen because authorisation, and not contract code, failed.</p>
          </Sec>

          <Sec n="02" title="The question nobody owns">
            <p>When an auditor, an investor or a regulator samples one movement, they ask four things. Your providers answer three of them from their own records.</p>
            <Table head={["Question", "Answered by", "From"]} rows={[...FOUR.map((f) => [f.q, f.who, f.a]), ["Was it allowed, by the right person, before it was signed?", "Q² answers this", "One Movement Record"]]} />
            <p>The fourth question is answered today with signer logs, the ledger, chat threads and screenshots, stitched together by hand after the event, often by the people whose decision is being examined. That is slow, and it is weak evidence: every piece comes from a party to the transaction.</p>
            <h3>“Was it allowed?” is six questions</h3>
            <p>Each one needs proof that did not come from whoever asked. The right-hand column shows where that proof was missing in a publicly reported incident.</p>
            <Table head={["#", "Question", "What good proof looks like", "Where it was missing"]} rows={SIX.map((s, i) => [String(i + 1), s.q, s.good, s.miss])} />
            <p>These six questions are the frame for everything that follows. The first call with Q² maps one of your own flows against them.</p>
          </Sec>

          <Sec n="03" title="What Q² is">
            <p>Q² is a record of authorisation for every movement of digital assets. It sits beside the signer, custodian and administrator you already use, and changes nothing in how they work. It does three things.</p>
            <ol className="bp-ladder" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginTop: "var(--space-8)" }}>
              <li><span className="bp-ladder__n mono">1</span><b>Check</b><p>Before a movement is signed, it is checked against your own rules and a named person's approval. What fails is refused, and the refusal is kept with its reason.</p></li>
              <li><span className="bp-ladder__n mono">2</span><b>Record</b><p>One ID follows the movement from the decision to the signature, the settlement and the ledger entry, across every provider.</p></li>
              <li><span className="bp-ladder__n mono">3</span><b>Prove</b><p>One sealed export per movement shows who authorised it, under which rule, and that what was signed and settled matches what was approved.</p></li>
            </ol>
            <h3>Where it sits</h3>
            <p>Facts flow in from the people and systems that act. Proof flows out to the people who check.</p>
            <Table head={["Party", "Its role", "What Q² does with it"]} qCol={2} rows={[
              ["You, the owner", "Authorises every movement", "Checks each movement against your mandate before anything is signed"],
              ["Signer", "Holds keys, signs", "Ties every signature to a named person's approval of the exact transaction"],
              ["Chain and custody", "Settles", "Matches what executed with what was approved"],
              ["Administrator", "Keeps the books", "Links who approved what to each ledger entry"],
              ["AI agents", "Propose actions", "Checks every agent action against a mandate a named person signed"],
              ["Auditor", "Checks the year", "One sealed export per sampled movement, in minutes"],
              ["Investors", "Put the capital in", "Proof that a rule was followed, without the underlying records"],
              ["Bank, regulator, insurer", "Supervise the risk", "A tamper-evident record, refusals included"],
            ]} />
            <h3>What Q² never does</h3>
            <ul className="bp-never">{NEVER.map((k) => <li key={k}><i aria-hidden="true">✕</i>{k}</li>)}</ul>
            <p style={{ marginTop: "var(--space-6)" }}>The keys stay with you and your signer. Compromising Q² moves no money, because Q² was never able to move any. That separation is also what makes the record worth having: it is kept by a party that could not have executed the movement.</p>
            {film("10", "Compromise Q², move nothing · 0:50")}
          </Sec>

          <Sec n="04" title="One movement, start to proof">
            <p>The clearest way to understand Q² is to follow one movement. A private credit fund lends 2,000,000 USDC to a borrower. There are seven steps, and each adds one fact to the same record.</p>
            <Table head={["Step", "Who acts", "What happens", "Fact added"]} rows={[
              ["1 · Request", "Fund", "An analyst asks to send the loan. Amount, wallet and purpose are captured once.", "Request"],
              ["2 · Check", "Q²", "Checked against the fund's mandate: the single-borrower limit, the approved borrower, two of three approvers. The record ID is created here, before any signature.", "Check result"],
              ["3 · Approve", "Fund", "Two partners approve the exact transaction, each on their own device. The analyst who proposed it cannot approve it.", "Approvals"],
              ["4 · Sign", "Signer", "The signer runs its own policies, unchanged, then signs. What it signs is compared with what was approved.", "Signature"],
              ["5 · Settle", "Chain", "The USDC settles. Q² reads the receipt from the network and matches it to the approval.", "Settlement"],
              ["6 · Book", "Administrator", "Booked in the ledger and matched back to the record.", "Ledger entry"],
              ["7 · Prove", "Q²", "One sealed export for the auditor or an investor.", "Evidence pack"],
            ]} />
            <h3>The Movement Record</h3>
            <Table head={["Field", EXAMPLE.record]} rows={[["Send", EXAMPLE.amount], ["Asked by", `${EXAMPLE.proposer}, analyst`], ["Rule", EXAMPLE.rule], ["Approved", EXAMPLE.approvers.join(" · ")], ["Signed", "Matches what was approved"], ["Settled", `${EXAMPLE.amount} to ${EXAMPLE.borrower}`], ["Booked", `Ledger entry ${EXAMPLE.ledger}`], ["Seal", "Sealed · ready for your auditor"]]} qCol={1} />
            <p>One ID follows the movement from request to proof. The record holds who asked, the rule that applied and the figure it was checked against, who approved, and confirmation that what was signed, settled and booked matches what was approved.</p>
            <p>In the example, the loan is 3.1% of the fund's net asset value against a 4% single-borrower limit, and that figure comes from the administrator, never from the request.</p>
            <p>The record is sealed so that any later change shows, and it can be exported in minutes: a document for people, structured data for auditors.</p>
            <h3>When a check fails</h3>
            <p>If the check, the approvals or the signer's own policies fail, the movement never reaches signing. The refusal is kept on the record with its reason, and an alert goes to the approvers. A second loan of 900,000 USDC to the same borrower would take the position to 4.5% of net asset value, past the 4% limit. It is refused, and the record says why. A refusal is evidence too: it shows the control worked.</p>
            <h3>The same record for other movements</h3>
            <Table head={["#", "A player payout", "An agent payment"]} rows={[
              ["1", "Request. The player's verified withdrawal: asset, amount, address.", "Mandate. A named person grants the agent a mandate: scope, limits, expiry."],
              ["2", "Check. The address is the player's depositing or verified wallet, inside payout limits. Screening status is recorded.", "Propose. The agent drafts a payment inside its task."],
              ["3", "Approve. A signed payout policy approves it. Above the threshold, a named person does.", "Check. Inside the mandate? Above its threshold, the draft goes to a person."],
              ["4", "Sign. The hot wallet signs. What it signs is compared with what was approved.", "Approve. A person approves the exact amount and payee."],
              ["5", "Settle. The payout settles and is matched to its record.", "Execute. The platform executes on its own rails."],
              ["6", "Reconcile. Balances reconcile to authorised payouts on the day.", "Settle. Settlement is matched to the approval."],
              ["7", "Prove. Approvals, refusals and reconciliations in the shape a regulator or payment partner asks for.", "Prove. Which agent, whose mandate, who approved, what settled."],
            ]} />
            <p>In the payout, the payout service cannot ask the hot wallet to sign on its own word. In the agent payment, the agent can propose and cannot approve.</p>
            {film("01", "One movement, one record · 1:10")}{film("08", "Evidence in minutes · 1:00")}
          </Sec>

          <Sec n="05" title="What the approver sees">
            <p>An approval is only worth something if the person saw what will really happen. In the largest thefts, approvers acted in good faith: the screen showed one thing and the transaction did another.</p>
            <p>Three things have to hold. What the approver sees is worked out from the exact transaction, by something the requester does not control. What they sign covers that transaction and that view together. And the check before signing verifies their signature itself.</p>
            <Table head={["#", "On the screen", "Why"]} rows={[
              ["1", "The effect, not a description", "Asset, amount, source and destination are decoded from the transaction itself, twice, by two unrelated decoders. If they differ, there is no Approve button. The screen says in words whether control of the account changes."],
              ["2", "The destination's history", "The whole address, when it was registered and whether it has been paid before. A destination added in the same session cannot be paid."],
              ["3", "Who asked, and their proof", "A named person, signed on their own key. “Asked by: payments service” is not an origin."],
              ["4", "The rule that allows it", "And where every number came from. Limits are checked on the administrator's figures, never on figures in the request."],
              ["5", "A short expiry", "Approvals cannot be stockpiled for later use."],
            ]} />
            <h3>When a transaction changes who controls the money</h3>
            <p>Upgrades, delegations, signer changes and spending approvals are labelled as what they are. They need more approvers, and they wait out a delay.</p>
            <p>In the example, a request described as a “routine transfer” would make another contract a controller of the fund's wallet. The screen shows the mismatch, requires three of four approvers and a 72-hour delay, and offers no Approve button.</p>
            <p>Four rules the screen never breaks. The whole address is shown, never shortened. A system is labelled a system, never shown as a person. Approval happens only on the approver's own device. Status is given in words and shape, never by colour alone.</p>
            <p>Already approve on hardware wallets with clear signing, security keys or passkeys? Keep them. Q² records those approvals and adds what the device cannot see: the rule that allows the movement, the source of each fact and the destination's history.</p>
            {film("04", "What the approver sees · 1:15")}
          </Sec>

          <Sec n="06" title="Evidence grades: a record that never proves a lie">
            <p>A seal proves nobody changed a record afterwards. It does not make the record true. A sealed record of a false claim is still false.</p>
            <p>So Q² never seals a claim as true. It seals who signed what, with what proof, and grades each movement by the strongest proof present when the decision was made.</p>
            <Table head={["Grade", "What it means", "What it does not prove", "Typical use"]} rows={GRADES.map((g) => [g.g, g.means, g.not.replace(/^Does not prove /, "That ").replace(/^Refused where.*/, "It proves nothing, and says so"), g.use])} />
            <p>If someone feeds the record a false claim, the record says exactly that: “system-asserted, no person's proof”, or “mismatch”. It never says “approved”. If one person's key is stolen, the record shows which key signed and that the approvals fell short. If the approvers themselves misbehave, the record proves who they were.</p>
            <p>Auditors already weigh evidence by its source and directness. A firm can show its auditor the share of movements at each grade, and the trend.</p>
            {film("05", "A system's word is not an approval · 1:00")}
          </Sec>

          <Sec n="07" title="What Q² stops, and what it flags">
            <p>Refusals are built first. In a pilot, each of the nine breaches below is attempted on purpose and must be refused, with a reason code and an alert. None can be overridden.</p>
            <ul className="bp-nine" style={{ margin: "var(--space-6) 0" }}>{NINE.map((k) => <li key={k}>{k}</li>)}</ul>
            <h3>The single-compromise test</h3>
            <p>For each thing an attacker could take over on its own, can money move outside the limits you set?</p>
            <Table head={["If only this is compromised", "Outcome", "Why"]} rows={LANES.map((l) => [l.k, l.out, l.long])} />
            <h3>One rule, three strengths of enforcement</h3>
            <p>Take one rule: a new destination cannot be paid for 48 hours after it is added, and not by the person who added it.</p>
            <Table head={["Strength", "Where", "What happens"]} rows={[
              ["Base", "In the workflow", "Q² returns a refusal and nothing is sent to the signer."],
              ["Add-on", "At the signer", "The signer refuses to sign without a valid Q² decision, so going around the workflow fails too. The check can only block, never authorise."],
              ["Add-on", "In the account", "The account itself refuses until 48 hours have passed, whoever submits and however."],
            ]} />
            <p>What no system can do is stop people with real authority agreeing to do the wrong thing. Limits bound the damage, and the record proves who decided.</p>
            {film("02", "Refused, with a reason · 1:00")}{film("03", "The proposer cannot approve · 0:50")}{film("06", "Change the rule, then try to use it · 1:00")}{film("07", "The payment that went around · 0:50")}
          </Sec>

          <Sec n="08" title="Working with what you already run">
            <p>Each control you already have proves something real, and each leaves the same question open. Q² replaces none of them. It ties them to the decision behind each movement.</p>
            <Table head={["You already have", "What it proves", "What it leaves open"]} rows={[
              ["Signer policies and approval quorums", "The transaction met the platform's rules, and the platform's approvers approved it.", "Rules the platform cannot see, such as limits on net asset value or whether a subscription was accepted. Anything on a second provider."],
              ["Pre-sign security or a co-signer", "The transaction does what it appears to do and matches no known threat.", "Who decided it, and under which mandate. An in-policy payment nobody legitimately asked for can still look safe."],
              ["Approvals on personal hardware", "A named person approved the exact transaction on a trusted screen.", "Automated flows with no person in them, your own business rules, and the other providers in the stack."],
              ["Rules written into token contracts", "Who may hold and receive a token, checked on every transfer.", "Who decided a mint, burn, freeze or forced transfer, and whether the cash leg matched."],
              ["Reconciliation and vendors' control reports", "Balances agree, and each vendor's controls ran over a period.", "That a given movement was authorised, in one record that spans the stack."],
              ["Security and smart contract audits", "Whether code or a system could be broken, at a date.", "Anything about an individual movement. The largest losses passed audited code and produced valid signatures."],
            ]} />
          </Sec>

          <Sec n="09" title="Capabilities and deployment">
            <p>There is one base. Optional add-ons are chosen separately and attach to the same record.</p>
            <Table head={["Capability", "What you get"]} rows={[
              ["Movement Record", "One ID created at a named person's decision, before any signature, and carried to the ledger entry"],
              ["Named approvals", "Named approvers and a quorum on every decision. The proposer cannot approve"],
              ["Refusal records", "What was stopped, by which rule and why, with an alert"],
              ["Bound to your signer", "The signer's policy result and every signing stage recorded. What is signed is compared with what was approved"],
              ["Rule-change history", "Every change to a rule, destination or control kept with who, when, before and after. Cooling-off periods. Change-then-use flagged"],
              ["Unmatched-movement alerts", "Any outflow with no Movement Record behind it is flagged as it settles"],
              ["Evidence export", "One tamper-evident export per movement: a document for people, structured data for auditors"],
              ["Post-quantum seal", "A hybrid classical and post-quantum seal (NIST FIPS 204) under every record, built to be re-sealed as algorithms retire"],
              ["Your own rules", "Approved counterparties, limits, subscription and payout checks, run on your administrator's or platform's own figures before signing"],
              ["Add-on · Selective disclosure", "Zero-knowledge proofs that show a rule was followed without handing over the records"],
              ["Add-on · Programmable controls", "Your rules written into the account itself, so they hold whoever submits"],
              ["Add-on · Signing-layer enforcement", "The signer signs only with a valid Q² decision. The check can only block"],
              ["Add-on · Agent gate", "AI agents act only inside a mandate a named person signed, checked on every action"],
              ["Add-on · Integration monitoring", "Front ends, integrations and agent connections checked daily for unexpected change"],
            ]} />
            <h3>Deployment and data</h3>
            <ul className="wp__list">
              <li><b>Where it runs.</b> Cloud, in-region or on-premise.</li>
              <li><b>What reaches Q².</b> Approvals, check results and transaction references.</li>
              <li><b>What never does.</b> Keys, credentials, and personal data of your investors, customers or players.</li>
              <li><b>Pricing.</b> A subscription covers one entity with its signer and administrator connected. Add-ons are priced on their own. Nothing is priced per approval.</li>
            </ul>
            {film("09", "Change one fact and it shows · 0:45")}
          </Sec>

          <Sec n="10" title="Why now">
            <Table head={["Force", "What is changing"]} rows={[
              ["Attackers", "Reaching a trusted position is getting cheaper. Attackers now use AI to find a way in faster than defenders can patch. In the largest incident of 2026, a compromised internal AI tool was part of the attacker's path."],
              ["Agents", "Software is starting to ask for money to move. The Financial Stability Board's sound practices for AI expect firms to identify agents, set triggers for human approval and name an accountable person."],
              ["Rules", "The controls are written down. The proof is your job. EU rules already require tamper-protected logs and records of rejected instructions. The SEC's custody proposal asks for at least two people to authorise a transfer."],
              ["Cryptography", "Records must outlive today's signatures. Evidence kept for five to seven years has to stay verifiable after current signature schemes are retired."],
            ]} />
            <h3>Every shift in finance produced a proof</h3>
            <ol className="bp-timeline">{TIMELINE.map(([y, h, s]) => <li key={y} className={y === "Now" ? "is-now" : ""}><span className="mono">{y}</span><b>{h}</b><span>{s}</span></li>)}</ol>
            <h3>The rules, in their own words</h3>
            <Table head={["Rule", "What it says", "What Q² gives you"]} qCol={2} rows={[
              ["EU · DORA ICT risk standard. Delegated Regulation (EU) 2024/1774, Art. 12(2)(d) · in force", "“measures to protect logging systems and log information against tampering, deletion, and unauthorised access”", "Sealed, tamper-evident records"],
              ["EU · MiCA record-keeping standard. Delegated Regulation (EU) 2025/1140, Art. 2(1)(c) and Annex · in force", "Records must include “any suspension or rejection of any instruction to carry out the transfer of crypto-assets”", "Refusals kept with their reason"],
              ["US · SEC crypto custody proposal. Proposed 1 October 2026", "“joint authorization of any crypto asset transactions by at least two people”", "Named approvers and a quorum on every decision"],
              ["Global · FSB sound practices for AI. Final report, 15 October 2026", "“clear, risk-based triggers for when an agent must seek human approval”", "Agents propose, people decide, on record"],
            ]} />
            <p className="bp-fine">Q² supports your compliance work. It does not replace legal advice, and using it does not by itself make a firm compliant. Regulatory summaries are for orientation.</p>
          </Sec>

          <Sec n="11" title="Quantum resilience">
            <Table head={["", "What", "How"]} rows={[
              ["Today · in the base", "Your records", "Every Q² record carries a hybrid seal: a classical signature and a post-quantum signature (NIST FIPS 204) together. Records can be re-sealed as algorithms retire, so evidence kept for years stays verifiable."],
              ["On request", "Your assets", "If you also want quantum resilience for the assets themselves, Q² can provide accounts you control: approvals are checked with post-quantum signatures, and a fresh signing key is used for every transaction, so no public key sits exposed."],
              ["The risk that stays", "The networks", "Each network still uses its own classical signatures to accept and order transactions. That risk stays with every provider until the networks upgrade. Fresh keys narrow it to the moment a transaction is in flight. They do not remove it."],
            ]} />
            <p>When a network does migrate, you or your custodian carries out the move, and Q² evidences who authorised each step.</p>
            <p>If quantum resilience for your assets is a requirement, talk to us. We will show you exactly where the remaining risk sits on the networks you use, and what can be done about it now.</p>
          </Sec>

          <Sec n="12" title="By sector">
            <p>Q² is for anyone who moves digital assets and has to show someone else it was allowed.</p>
            <Table head={["Who", "The problem", "What Q² adds", "First step"]} rows={[
              ["Funds: general partners, COOs, fund managers", "Proof that a movement was authorised is assembled by hand, and fund limits are checked by people with no record of the result.", "A check against the fund's own rules before signing, and one sealed record per movement.", "Map one flow to the six questions"],
              ["Administrators and transfer agents", "You reconcile what moved, then are asked to evidence an authorisation you never saw.", "The authorisation behind each transaction, arriving with it. A service you can offer every fund you administer.", "Review a sample evidence pack"],
              ["Tokenisation platforms: issuance platforms and their issuers", "Your contracts enforce who may hold. Reviewers also ask who authorised each mint, burn and rule change.", "A record of privileged actions, with the cash leg and the token action under one ID.", "Map one issuance flow"],
              ["iGaming and payments: operators and crypto payment providers", "Payouts must be fast, so a payout service decides what the hot wallet signs. Licence conditions ask who approved each transfer and what was refused.", "Every payout tied to a verified withdrawal. Refusals and reconciliations on record.", "A diagnostic against your licence conditions"],
              ["Platforms running agents: treasury, payments and banking platforms", "A bank or auditor asks which agent acted, who gave it authority and who approved the money moving, from a source that is not the platform itself.", "A mandate record: agents propose, people or a signed policy approve.", "Design the mandate record together"],
              ["Auditors and security firms: readers of the record", "Evidence of authorisation arrives as screenshots from several parties.", "One export per sampled movement. Q² does not audit, attest or certify.", "Tell us what you would sample and accept"],
            ]} />
            <p>Where Q² adds little, and we say so at the start. One custodian holds everything, there are a handful of movements a year, and your auditor is satisfied. The custodian's own reports cover most of what a reviewer asks.</p>
          </Sec>

          <Sec n="13" title="Getting started">
            <p>Start small, and pass on evidence. Each step is priced so you can stop after it.</p>
            <ol className="bp-ladder" style={{ marginTop: "var(--space-8)" }}>{LADDER.map((s) => <li key={s.n}><span className="bp-ladder__n mono">{s.n}</span><b>{s.h}</b><span className="mono bp-ladder__meta">{s.meta}</span><p>{s.p}</p></li>)}</ol>
            <h3>The pilot, week by week</h3>
            <Table head={["Week", "Stage", "What happens"]} rows={[["1", "Connect", "Your signer and administrator are connected, read-only."], ["2", "Refuse", "The nine breach attempts are run, and each must be refused."], ["3", "Approve and match", "Approvals are bound to what is signed, settled and booked."], ["4", "Prove", "Results are scored against the seven criteria below."]]} />
            <h3>How we both know the pilot worked</h3>
            <Table head={["#", "Criterion", "Measure"]} rows={CRITERIA.map(([k, v], i) => [String(i + 1), k, v])} />
          </Sec>

          <Sec n="14" title="Limits: what Q² does not do">
            <p>Stated limits are what make the rest believable. Each of these is one a careful reviewer would otherwise find for themselves.</p>
            <ul className="wp__list">
              <li>It does not hold keys, sign, co-sign, approve or move funds, at any stage. That is what keeps the record separate from whoever executes.</li>
              <li>It cannot recall a transfer that has settled. In the base product, a payment started directly at the signer is flagged as it settles, and blocked only once the signer requires a Q² decision.</li>
              <li>It cannot stop people with real authority agreeing to do the wrong thing. Limits bound the damage, and the record proves who decided.</li>
              <li>It does not detect threats, review code or run penetration tests, and it does not replace your policy engine, co-signer or monitoring.</li>
              <li>It does not audit, attest or certify, and using it does not by itself make a firm compliant.</li>
              <li>Its seal protects records. Quantum resilience for assets is a separate option, with a risk that stays until the networks upgrade (section 11).</li>
            </ul>
          </Sec>

          <Sec n="15" title="Questions asked first">
            <dl className="bp-faq">{FAQ.map(([q, a]) => <div key={q}><dt>{q}</dt><dd>{a}</dd></div>)}</dl>
          </Sec>

          <Sec n="16" title="Glossary and sources">
            <dl className="wp__gloss">
              {[
                ["Approver", "A named person entitled to approve a movement. Never the person who proposed it."],
                ["Change of control", "A transaction that alters who can move the assets: an upgrade, a delegation, a signer change or a spending approval."],
                ["Cooling-off period", "A wait between a change (a new destination, a changed rule) and its first use."],
                ["Evidence grade", "A rating of 1, 2, 3 or 0 for the strongest evidence of authorisation present when a movement was decided."],
                ["Evidence pack", "The sealed export for one movement: a document for people and structured data for auditors."],
                ["Mandate", "Rules signed by entitled people that say what may move, within which limits, and who must approve."],
                ["Movement Record", "The single record, under one ID, that follows a movement from request to ledger entry."],
                ["Proposer", "The person, or the agent acting inside a mandate, who asks for a movement."],
                ["Quorum", "The number of named approvers a movement needs, for example two of three."],
                ["Reason code", "The stated reason a movement was refused, kept on the record."],
                ["Seal", "Signatures over a record, classical and post-quantum together, so that any later change shows."],
                ["Signer", "The system that holds keys and signs: a custody platform, a multi-party computation provider or a wallet."],
                ["Unmatched movement", "An outflow with no Movement Record behind it. Flagged as it settles."],
              ].map(([k, v]) => <div key={k} style={{ display: "contents" }}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
            <h3>Sources and notes</h3>
            <p className="bp-fine">Incident figures: Binance, initial findings (3 November 2026); TRM Labs (29 and 30 October 2026); public reporting on Bybit, Ronin, Bitget, DMM, KelpDAO, Drift, WazirX and Radiant. Rules: Delegated Regulation (EU) 2024/1774; Delegated Regulation (EU) 2025/1140; SEC crypto custody proposal (1 October 2026); Financial Stability Board, sound practices for the responsible adoption of AI, final report (15 October 2026); NIST FIPS 204. Names, amounts and record numbers in the worked examples are illustrative. Prices as published on quantumqustody.com in November 2026.</p>
            <p className="bp-fine">Q² supports compliance evidence. It does not confer compliance, and it does not audit, attest or certify.</p>
            <p className="wp__callout">You hold the keys. Q² proves every decision made with them.</p>
            <div className="hero__ctas"><Pill href="/#start" onClick={(e) => { e.preventDefault(); go("/#start"); }}>Book a 30-minute call</Pill><Pill href={PDF} variant="ghost">Download PDF</Pill></div>
            <p className="bp-fine">© 2026 Quantum Qustody Inc. Whitepaper version 1.0, November 2026.</p>
          </Sec>
        </article>
      </div>
    </main>
  );
}
