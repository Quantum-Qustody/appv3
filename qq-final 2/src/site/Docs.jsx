import { useEffect } from "react";

// Public developer docs. Generic on purpose: no partner or customer is named,
// and every capability carries its status. Partner-specific guides (for a given
// signing SDK or administrator) are shared privately on request.

const TOC = [
  ["Start", [["overview", "Overview"], ["status", "Status of these docs"], ["boundary", "Who does what"]]],
  ["Concepts", [["movement-record", "Movement Record and MRID"], ["evidence-chain", "Movement Evidence Chain"], ["refusals", "Refusal Records"], ["seal", "The seal"]]],
  ["Integrate", [["flow", "End-to-end flow"], ["signer", "With your signer"], ["carriage", "Carrying the MRID"], ["administrator", "With your administrator"]]],
  ["Reference", [["api", "API (draft)"], ["webhooks", "Webhooks"], ["schema", "Evidence chain schema"], ["reasons", "Reason codes"], ["sandbox", "Sandbox"], ["security", "Security boundaries"]]],
];

const Tag = ({ s }) => <span className={`status status--${s}`}>{{ sandbox: "Sandbox", design: "In design", roadmap: "Roadmap" }[s]}</span>;

const Endpoint = ({ verb, path, children }) => (
  <div className="ep">
    <div className="ep__sig"><span className={`ep__verb ep__verb--${verb.toLowerCase()}`}>{verb}</span><code className="ep__path">{path}</code></div>
    {children}
  </div>
);

const Code = ({ label, children }) => (
  <figure className="code shell docs__code">
    <div className="shell__core">
      {label && <figcaption><span>{label}</span><span>Draft. Interface may change.</span></figcaption>}
      <pre tabIndex={0}><code>{children}</code></pre>
    </div>
  </figure>
);

export default function DocsPage({ go }) {
  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (h) setTimeout(() => document.getElementById(h)?.scrollIntoView({ block: "start" }), 60);
  }, []);
  const jump = (id) => (e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); history.replaceState(null, "", `/docs#${id}`); };

  return (
    <main id="main" className="lp page docs">
      <div className="wrap docs__grid">
        <nav className="docs__toc" aria-label="Developer docs contents">
          <p className="docs__ver">Draft v0.1 · Oct 2026</p>
          {TOC.map(([grp, items]) => (
            <div key={grp}>
              <p className="docs__grp">{grp}</p>
              <ol>{items.map(([id, label]) => <li key={id}><a href={`#${id}`} onClick={jump(id)}>{label}</a></li>)}</ol>
            </div>
          ))}
        </nav>

        <article className="docs__body">
          <header className="docs__head">
            <p className="docs__kicker">Developer docs</p>
            <h1>Integrate Q² with your fund estate</h1>
            <p className="docs__lede">Q² produces one exportable evidence chain per movement: who proposed it, which policy and fund context it was decided against, who approved it, what your signer checked and signed, what settled on chain and how it was booked. These docs show how a platform that already calls a signing SDK feeds that chain, and what the Q² API looks like.</p>
            <div className="docs__tags"><Tag s="design" /> API and integrations <Tag s="sandbox" /> evidence services</div>
          </header>

          <section>
            <h2 id="overview">Overview</h2>
            <p>Every party in a movement path keeps its own truth. The signer is the source of signing truth, the chain of settlement truth, the administrator of ledger truth. None of them is the source of <strong>correlated</strong> truth, which is what an auditor, an investor in diligence or an examiner asks for. Today that join is assembled by hand.</p>
            <p>Q² mints one identifier, the <strong>Movement Record ID (MRID)</strong>, when a movement is decided and before any signature exists. Every later fact attaches to it. The output is the <strong>Movement Evidence Chain</strong>: one artifact, exported in minutes, with no manual stitching.</p>
            <div className="docs__note"><p><strong>In short.</strong> Nothing changes in how your signer signs or enforces its own policies. Your platform makes one call to Q² before asking the signer to sign, one after submission, and relays the transaction state as it changes. Q² never holds key material and never asks a signer to sign.</p></div>
          </section>

          <section>
            <h2 id="status">Status of these docs</h2>
            <p>This is a draft specification for discussion, not a published API. Nothing here is live in production.</p>
            <dl className="docs__dl">
              <div><dt><Tag s="sandbox" /></dt><dd>Demonstrated in the Q² evaluation sandbox: evidence and audit-log services, policy-change attestation, the governance data model, the scenario engine.</dd></div>
              <div><dt><Tag s="design" /></dt><dd>Specified, not yet built: the public API, MRID issuance, the evidence-chain export, the eligibility engine, signer and administrator adapters, webhooks.</dd></div>
            </dl>
            <p>Paths, fields and payloads are versioned under <code>/v0</code> and may change. Partner-specific integration guides are shared on request.</p>
          </section>

          <section>
            <h2 id="boundary">Who does what</h2>
            <div className="docs__roles">
              <div><b>The fund</b><span>Originates and authorises every movement. Owns root and recovery authority.</span></div>
              <div className="is-q"><b>Q²</b><span>Decides eligibility against fund context, mints the MRID, records and seals the evidence.</span></div>
              <div><b>The signer</b><span>Enforces transaction-level policy, holds key shares, runs signing.</span></div>
              <div><b>The administrator</b><span>Records, reconciles and reports. The source of ledger truth.</span></div>
            </div>
            <p>No automation, including Q²'s, crosses from validation into origination. There is no bypass path: a failed check never completes.</p>
          </section>

          <section>
            <h2 id="movement-record">Movement Record and MRID</h2>
            <p>A Movement Record is created when your platform asks Q² to decide a proposed movement. It is append-only: facets are added as each party reports, never edited.</p>
            <div className="docs__tbl"><table>
              <thead><tr><th>Field</th><th>Example</th><th>Notes</th></tr></thead>
              <tbody>
                <tr><td><code>mrid</code></td><td><code>mr_01JB8Q2KF9M4ZP7W3T</code></td><td>Sortable by time. Minted before any signature exists.</td></tr>
                <tr><td><code>entity</code></td><td><code>fund:example-master</code></td><td>Exports carry their own entity context.</td></tr>
                <tr><td><code>proposer</code></td><td><code>person:gp-1</code></td><td>A person, system or agent. Proposers never approve their own movement.</td></tr>
                <tr><td><code>mandate</code>, <code>policy_version</code></td><td><code>IPS-2026.2</code>, <code>pol-v3.2</code></td><td>The policy state the decision was made against, pinned by version.</td></tr>
                <tr><td><code>decision</code></td><td><code>eligible</code> or <code>refused</code></td><td>With reason codes and an expiry. The signer is called only for an eligible, unexpired, approved decision.</td></tr>
                <tr><td><code>facets[]</code></td><td>approval, signer.policy_check, signer.state, chain.receipt, ledger.entry</td><td>Each facet is timestamped on receipt and hash-chained to the previous one.</td></tr>
              </tbody>
            </table></div>
          </section>

          <section>
            <h2 id="evidence-chain">Movement Evidence Chain</h2>
            <p>The export for one MRID. It answers the question every reviewer asks: <strong>was this movement authorised, under which policy, and did what happened match what was approved?</strong></p>
            <ol className="docs__steps">
              <li><strong>Proposal.</strong> Who proposed what, from which account, to which destination, under which mandate.</li>
              <li><strong>Eligibility.</strong> The fund context used (for example limits relative to NAV, which a transaction-level engine cannot see), the policy version and the result.</li>
              <li><strong>Approvals.</strong> Each approver, the credential used, the time and the quorum met. The credential that changed a policy cannot immediately execute under it.</li>
              <li><strong>Signer policy check.</strong> Your signer's own policy result, as returned.</li>
              <li><strong>Signing and broadcast.</strong> The signer's transaction id, its state transitions, the unsigned transaction hash and the broadcast receipt.</li>
              <li><strong>Settlement and ledger.</strong> The on-chain receipt and the administrator's ledger entry.</li>
              <li><strong>Seal.</strong> The head hash of the chain, sealed by Q², so tampering with any facet is detectable.</li>
            </ol>
            <p>Formats: JSON (canonical, for tooling) and PDF (for people). Both carry the same head hash. <Tag s="design" /></p>
          </section>

          <section>
            <h2 id="refusals">Refusal Records</h2>
            <p>A refused movement is a first-class record with a reason code and no downstream facets. It proves a control fired, which a successful movement cannot. Refusals from Q², from the signer and from the approval step all land in the same record type.</p>
          </section>

          <section>
            <h2 id="seal">The seal</h2>
            <p>Each facet carries <code>prev_hash</code>, a SHA3-256 hash of the previous facet's canonical JSON, so the chain is tamper-evident. The head is sealed with hybrid classical and post-quantum signatures (NIST FIPS 204) and re-sealed as algorithms retire. The seal covers Q²'s records only; on-chain signatures stay classical.</p>
          </section>

          <section>
            <h2 id="flow">End-to-end flow</h2>
            <ol className="docs__flow">
              <li><span>Platform → Q²</span><code>POST /v0/movements</code> Proposal and a reference to fund context. Q² returns the MRID and a decision.</li>
              <li><span>Q² → approvers</span><code>approval.requested</code> Out of band. Approvals recorded with <code>POST /v0/movements/{"{mrid}"}/approvals</code>.</li>
              <li><span>Platform → signer</span>Your signer's policy check, then submission, unchanged.</li>
              <li><span>Platform → Q²</span><code>POST /v0/movements/{"{mrid}"}/signer</code> The signer's transaction record, unmodified. Q² binds its id to the MRID.</li>
              <li><span>Platform → Q²</span><code>POST /v0/movements/{"{mrid}"}/signer/state</code> Each state change: signed, broadcast, success or failure.</li>
              <li><span>Chain, administrator → Q²</span>Receipt by transaction hash; ledger entry by MRID or hash. Read only.</li>
              <li><span>Anyone with access</span><code>GET /v0/movements/{"{mrid}"}/evidence-chain</code> The export.</li>
            </ol>
          </section>

          <section>
            <h2 id="signer">With your signer</h2>
            <p>Most signing SDKs are wrapped by the fund's own platform, which already records extra data or runs its own approval flow before requesting a signature. Q² attaches at exactly that point, inside your wrapper, so the signer's code and policies do not change.</p>
            <Code label="wrapper.ts">
<span className="k">import</span> {"{ Q2 }"} <span className="k">from</span> <span className="s">"./q2-client"</span>;   <span className="c">// draft client for the API below</span>{"\n"}
<span className="k">import</span> {"{ signer }"} <span className="k">from</span> <span className="s">"./your-signer-sdk"</span>;{"\n\n"}
<span className="k">export async function</span> moveFunds(req) {"{"}{"\n"}
{"  "}<span className="c">// 1. Decide before anything is signed. Q² mints the MRID here.</span>{"\n"}
{"  "}<span className="k">const</span> mv = <span className="k">await</span> q2.movements.create({"{"} entity: <span className="s">"fund:example-master"</span>, proposer: req.proposer,{"\n"}
{"    "}mandate: req.mandate, policyVersion: req.policyVersion, action: req.action, context: {"{"} navSnapshotRef: req.navRef {"}"} {"}"});{"\n"}
{"  "}<span className="k">if</span> (mv.decision.status === <span className="s">"refused"</span>) <span className="k">return</span> mv;          <span className="c">// Refusal Record already written</span>{"\n\n"}
{"  "}<span className="c">// 2. Quorum: people, or a policy they signed. Fails closed on expiry.</span>{"\n"}
{"  "}<span className="k">const</span> ok = <span className="k">await</span> q2.movements.waitForApproval(mv.mrid);{"\n"}
{"  "}<span className="k">if</span> (ok.decision.status !== <span className="s">"approved"</span>) <span className="k">return</span> ok;{"\n\n"}
{"  "}<span className="c">// 3. Your signer checks its own policies, unchanged.</span>{"\n"}
{"  "}<span className="k">const</span> check = <span className="k">await</span> signer.checkPolicies(req.account, req.tx);{"\n"}
{"  "}<span className="k">if</span> (check.breach) <span className="k">return</span> q2.movements.refuse(mv.mrid, {"{"} code: <span className="s">"SIGNER_POLICY_BREACH"</span>, signerCheck: check {"}"});{"\n\n"}
{"  "}<span className="c">// 4. Submit, then bind the signer's transaction id to the MRID.</span>{"\n"}
{"  "}<span className="k">const</span> tx = <span className="k">await</span> signer.submit(req.account, req.tx);{"\n"}
{"  "}<span className="k">await</span> q2.movements.attachSigner(mv.mrid, tx);{"\n"}
{"  "}<span className="k">await</span> db.mridBySignerTx.put(tx.id, mv.mrid);{"\n"}
{"  "}<span className="k">return</span> {"{"} mrid: mv.mrid, signerTransactionId: tx.id {"}"};{"\n"}
{"}"}
            </Code>
            <p>Q² stores the signer's values as received and timestamps receipt. It compares the submitted parameters with the approved action and refuses on any mismatch.</p>
          </section>

          <section>
            <h2 id="carriage">Carrying the MRID</h2>
            <div className="docs__tbl"><table>
              <thead><tr><th>Option</th><th>How</th><th>Evidence strength</th></tr></thead>
              <tbody>
                <tr><td><strong>Wrapper mapping</strong> (default)</td><td>Your wrapper stores <code>signer tx id ↔ mrid</code> at submission and reports both to Q². No signer change.</td><td>Strong. The binding is recorded before signing.</td></tr>
                <tr><td><strong>Native reference</strong></td><td>The signer carries an external reference on the transaction and returns it on its events.</td><td>Strongest. The MRID appears in the signer's own record.</td></tr>
                <tr><td><strong>Fallback match</strong></td><td>Correlate by unsigned hash, broadcast hash, address, amount and time window.</td><td>Workable, weaker and heavier to build.</td></tr>
              </tbody>
            </table></div>
          </section>

          <section>
            <h2 id="administrator">With your administrator</h2>
            <p>Read only, with no investor personal data at any point. Q² needs fund context for eligibility (NAV and obligor identity at the granularity your limits need) and the ledger entry that booked a movement, ideally indexed by the MRID, otherwise by transaction hash. Until a read API is scoped, the sandbox runs on a synthetic context model.</p>
          </section>

          <section>
            <h2 id="api">API (draft) <Tag s="design" /></h2>
            <p>REST over HTTPS with JSON bodies. Bearer API keys, one per environment. Every write is idempotent with an <code>Idempotency-Key</code> header.</p>
            <Endpoint verb="POST" path="/v0/movements"><p>Propose a movement and get an eligibility decision. Mints the MRID. A refusal is a result, not an error.</p></Endpoint>
            <Code label="POST /v0/movements">
{"{"}{"\n"}
{"  "}<span className="s">"entity"</span>: <span className="s">"fund:example-master"</span>,{"\n"}
{"  "}<span className="s">"proposer"</span>: <span className="s">"person:gp-1"</span>,{"\n"}
{"  "}<span className="s">"mandate"</span>: <span className="s">"IPS-2026.2"</span>,{"\n"}
{"  "}<span className="s">"policy_version"</span>: <span className="s">"pol-v3.2"</span>,{"\n"}
{"  "}<span className="s">"action"</span>: {"{"} <span className="s">"account"</span>: <span className="s">"signer:acc_7f2"</span>, <span className="s">"chain_id"</span>: 1, <span className="s">"to"</span>: <span className="s">"0x8a…41"</span>, <span className="s">"asset"</span>: <span className="s">"USDC"</span>, <span className="s">"amount"</span>: <span className="s">"250000.00"</span> {"}"},{"\n"}
{"  "}<span className="s">"context"</span>: {"{"} <span className="s">"nav_snapshot_ref"</span>: <span className="s">"admin:nav/2026-10-17"</span> {"}"}{"\n"}
{"}"}{"\n"}
<span className="c">// 201</span>{"\n"}
{"{"} <span className="s">"mrid"</span>: <span className="s">"mr_01JB8Q2KF9M4ZP7W3T"</span>, <span className="s">"decision"</span>: {"{"} <span className="s">"status"</span>: <span className="s">"eligible"</span>, <span className="s">"requires"</span>: <span className="s">"quorum 2 of 3"</span>, <span className="s">"expires_at"</span>: <span className="s">"2026-10-20T15:00:00Z"</span> {"}"} {"}"}
            </Code>
            <Endpoint verb="POST" path="/v0/movements/{mrid}/approvals"><p>Record an approval or rejection by a named approver. The proposer cannot approve. When the quorum is met the decision becomes <code>approved</code>.</p></Endpoint>
            <Endpoint verb="POST" path="/v0/movements/{mrid}/signer"><p>Attach the signer's transaction record from submission, unmodified. Refuses with <code>PARAMS_MISMATCH</code> if it differs from the approved action.</p></Endpoint>
            <Endpoint verb="POST" path="/v0/movements/{mrid}/signer/state"><p>Report a signer state change. Appends a <code>signer.state</code> facet.</p></Endpoint>
            <Endpoint verb="POST" path="/v0/movements/{mrid}/refusal"><p>Record a refusal raised outside Q², such as a signer policy breach.</p></Endpoint>
            <Endpoint verb="GET" path="/v0/movements/{mrid}"><p>Current state of a Movement Record and its facets.</p></Endpoint>
            <Endpoint verb="GET" path="/v0/movements/{mrid}/evidence-chain?format=json|pdf"><p>Export the Movement Evidence Chain, within minutes of the last facet.</p></Endpoint>
            <Endpoint verb="GET" path="/v0/movements?entity=…&from=…&to=…&status=refused"><p>List records for a period, for example every refusal last quarter.</p></Endpoint>
          </section>

          <section>
            <h2 id="webhooks">Webhooks <Tag s="design" /></h2>
            <p>Signed with HMAC-SHA256 in a <code>Q2-Signature</code> header, retried with backoff, delivered at least once. Deduplicate on <code>event_id</code>.</p>
            <div className="docs__tbl"><table>
              <thead><tr><th>Event</th><th>When</th></tr></thead>
              <tbody>
                <tr><td><code>movement.decided</code></td><td>An eligibility decision was made.</td></tr>
                <tr><td><code>approval.requested</code></td><td>An approver must act. Delivered out of band.</td></tr>
                <tr><td><code>approval.stalled</code></td><td>No quorum within the alert window. An alert, never a silent queue.</td></tr>
                <tr><td><code>movement.refused</code></td><td>A Refusal Record was written, with its reason code.</td></tr>
                <tr><td><code>chain.completed</code></td><td>Settlement and ledger facets are in; the chain is ready to export.</td></tr>
              </tbody>
            </table></div>
          </section>

          <section>
            <h2 id="schema">Evidence chain schema</h2>
            <p>Abridged JSON export for one approved movement. Synthetic values.</p>
            <Code label="evidence-chain.json">
{"{"}{"\n"}
{"  "}<span className="s">"mrid"</span>: <span className="s">"mr_01JB8Q2KF9M4ZP7W3T"</span>, <span className="s">"entity"</span>: <span className="s">"fund:example-master"</span>, <span className="s">"status"</span>: <span className="s">"settled"</span>,{"\n"}
{"  "}<span className="s">"facets"</span>: [{"\n"}
{"    "}{"{"} <span className="s">"type"</span>: <span className="s">"proposal"</span>,            <span className="s">"at"</span>: <span className="s">"2026-10-20T13:02:11Z"</span>, <span className="s">"prev_hash"</span>: <span className="k">null</span> {"}"},{"\n"}
{"    "}{"{"} <span className="s">"type"</span>: <span className="s">"eligibility"</span>,         <span className="s">"at"</span>: <span className="s">"2026-10-20T13:02:12Z"</span>, <span className="s">"result"</span>: <span className="s">"eligible"</span>, <span className="s">"prev_hash"</span>: <span className="s">"…"</span> {"}"},{"\n"}
{"    "}{"{"} <span className="s">"type"</span>: <span className="s">"approval"</span>,            <span className="s">"at"</span>: <span className="s">"2026-10-20T13:09:40Z"</span>, <span className="s">"quorum"</span>: <span className="s">"2 of 3"</span>, <span className="s">"prev_hash"</span>: <span className="s">"…"</span> {"}"},{"\n"}
{"    "}{"{"} <span className="s">"type"</span>: <span className="s">"signer.policy_check"</span>, <span className="s">"at"</span>: <span className="s">"2026-10-20T13:09:43Z"</span>, <span className="s">"breach"</span>: <span className="k">false</span>, <span className="s">"prev_hash"</span>: <span className="s">"…"</span> {"}"},{"\n"}
{"    "}{"{"} <span className="s">"type"</span>: <span className="s">"signer.state"</span>,        <span className="s">"at"</span>: <span className="s">"2026-10-20T13:10:05Z"</span>, <span className="s">"state"</span>: <span className="s">"broadcast"</span>, <span className="s">"prev_hash"</span>: <span className="s">"…"</span> {"}"},{"\n"}
{"    "}{"{"} <span className="s">"type"</span>: <span className="s">"chain.receipt"</span>,       <span className="s">"at"</span>: <span className="s">"2026-10-20T13:10:31Z"</span>, <span className="s">"status"</span>: <span className="s">"success"</span>, <span className="s">"prev_hash"</span>: <span className="s">"…"</span> {"}"},{"\n"}
{"    "}{"{"} <span className="s">"type"</span>: <span className="s">"ledger.entry"</span>,        <span className="s">"at"</span>: <span className="s">"2026-10-20T14:00:02Z"</span>, <span className="s">"ref"</span>: <span className="s">"je_88213"</span>, <span className="s">"prev_hash"</span>: <span className="s">"…"</span> {"}"}{"\n"}
{"  "}],{"\n"}
{"  "}<span className="s">"seal"</span>: {"{"} <span className="s">"head_hash"</span>: <span className="s">"sha3-256:9c4e…e8a5"</span>, <span className="s">"suite"</span>: <span className="s">"hybrid classical + post-quantum (FIPS 204)"</span> {"}"}{"\n"}
{"}"}
            </Code>
          </section>

          <section>
            <h2 id="reasons">Reason codes</h2>
            <div className="docs__tbl"><table>
              <thead><tr><th>Code</th><th>Raised by</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>ELIG_CONCENTRATION_OBLIGOR</code></td><td>Q²</td><td>Would breach a per-obligor limit against current NAV.</td></tr>
                <tr><td><code>ELIG_CONCENTRATION_PLATFORM</code></td><td>Q²</td><td>Would breach a per-platform limit.</td></tr>
                <tr><td><code>ELIG_SUBSCRIPTION_UNACCEPTED</code></td><td>Q²</td><td>Subscription funds not yet matched, screened and accepted.</td></tr>
                <tr><td><code>ELIG_CONTEXT_UNAVAILABLE</code></td><td>Q²</td><td>Fund context missing or stale. Fails closed.</td></tr>
                <tr><td><code>APPROVAL_EXPIRED</code></td><td>Q²</td><td>Quorum not met before the decision expired.</td></tr>
                <tr><td><code>APPROVAL_REJECTED</code></td><td>Q²</td><td>An approver rejected the movement.</td></tr>
                <tr><td><code>SEPARATION_OF_DUTIES</code></td><td>Q²</td><td>The credential that changed the policy tried to execute under it.</td></tr>
                <tr><td><code>SIGNER_POLICY_BREACH</code></td><td>Signer</td><td>The signer's policy check failed; its result is attached.</td></tr>
                <tr><td><code>PARAMS_MISMATCH</code></td><td>Q²</td><td>The submitted transaction differs from the approved action.</td></tr>
                <tr><td><code>SIGNER_FAILURE</code></td><td>Signer</td><td>The signer reported a failure.</td></tr>
              </tbody>
            </table></div>
          </section>

          <section>
            <h2 id="sandbox">Sandbox</h2>
            <ul className="docs__list">
              <li>The Q² sandbox runs on synthetic data, with no access to your systems, keys or investor data. <Tag s="sandbox" /></li>
              <li>Signer integration is tested against your signer's test environment or tenant.</li>
              <li>The governance flow can be tried today in the evaluation sandbox on the Ethereum Sepolia testnet.</li>
            </ul>
          </section>

          <section>
            <h2 id="security">Security boundaries</h2>
            <ul className="docs__list">
              <li>Q² holds no keys, key shares, signing credentials or funds, under any integration pattern.</li>
              <li>Q² never asks a signer to sign or originate. It only receives what your platform reports.</li>
              <li>Fail closed: missing context, an expired decision or an unreachable Q² means the movement does not proceed. The export plane stays available when the decision plane is not.</li>
              <li>No investor personal data leaves the administrator; context is passed by reference.</li>
            </ul>
          </section>

          <section className="docs__cta">
            <h2>Integrating Q²?</h2>
            <p>We share partner-specific guides for signing SDKs and fund administrators, and run integration sessions with your engineers.</p>
            <p>Write to <strong className="docs__mail">info@quantumqustody.com</strong>, or <a href="/#start" onClick={(e) => { e.preventDefault(); go("/#start"); }}>book a 30-minute diagnostic call</a>.</p>
          </section>
          <p className="docs__fine">Q² supports compliance evidence; it does not by itself make a firm compliant.</p>
        </article>
      </div>
    </main>
  );
}
