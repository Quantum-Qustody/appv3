// Shared copy for the home page, the sector pages and the whitepaper.
// Source: Q² Website Blueprint v3 and Whitepaper v1.0 (Chee Yang Ng, 13 Nov 2026).
// One example everywhere: the 2,000,000 USDC loan, record MR-7F3A-0921.
// Wording rules: "proof of authorisation"; "tamper-evident"; "as it settles";
// "supports your compliance work". No client, partner or vendor names.

export const INCIDENTS = [
  ["Binance", "2026", 6340, "$6.34bn"],
  ["Bybit", "2025", 1500, "$1.5bn"],
  ["Ronin", "2022", 625, "$625m"],
  ["Bitget", "2026", 388, "$388m"],
  ["DMM", "2024", 308, "$308m"],
  ["KelpDAO", "2026", 292, "$292m"],
  ["Drift", "2026", 285, "$285m"],
  ["WazirX", "2024", 235, "$235m"],
  ["Radiant", "2024", 50, "$50m"],
];

export const PATTERNS = [
  { k: "Hijacked request", from: "Trusted system", op: "→", to: "Signer signs", p: "The signer trusts whoever sits in a trusted position: a service, a credential, a tool.", fix: "No movement without a named person's approval, or a mandate a person signed." },
  { k: "Deceived approver", from: "Screen: “transfer”", op: "≠", to: "Signed: “hand over control”", p: "People approve what a screen shows, not what gets signed.", fix: "Approval bound to the exact transaction, with its effect worked out independently." },
  { k: "Single witness", from: "One verifier says yes", op: "→", to: "Funds released", p: "One verifier's word becomes the truth.", fix: "A second record, kept outside the system that executes." },
];

export const FOUR = [
  { q: "Was it signed under policy?", a: "Its policy result and signature", who: "Your signer" },
  { q: "What settled, and where?", a: "The transaction itself", who: "The chain" },
  { q: "What was booked?", a: "The ledger and its reconciliation", who: "Your administrator" },
];

export const SIX = [
  { q: "Who asked?", a: "A person, never a system's word", good: "A named person entitled to start this movement, or a mandate a person signed. Never a service, script or agent acting on its own word.", miss: "Binance: no customer or treasury request behind any outflow" },
  { q: "Were they allowed?", a: "Rules no one changes alone", good: "Rules whose every change needed more than one person, a delay and notice to the approvers.", miss: "Drift: limits widened by the same authority that was stolen" },
  { q: "Did they see the real effect?", a: "Decoded from the transaction", good: "The effect worked out from the exact transaction, by something the requester does not control.", miss: "Bybit: signers approved what a compromised screen showed" },
  { q: "Were the facts true?", a: "Registered destinations, checked figures", good: "Destinations registered in advance. Limits checked on the administrator's figures, never on figures in the request.", miss: "DMM: a destination changed after approval" },
  { q: "Was it checked before signing?", a: "Where the money leaves", good: "Checked where the money leaves, against that proof, stopping if the check cannot run.", miss: "Binance: the signing service acted on what an internal system told it" },
  { q: "How fast is it seen and proven?", a: "Flagged as it settles, exported in minutes", good: "An outflow with no record behind it is flagged as it settles. One sealed export per movement, in minutes.", miss: "Ronin: noticed after six days" },
];

export const FLOWS = [
  {
    id: "loan", label: "A fund loan",
    steps: [
      ["Fund", "Request", "An analyst asks to send 2,000,000 USDC."],
      ["Q² · Check", "Check", "Limit, borrower and approvers checked. The record starts here."],
      ["Fund", "Approve", "Two partners approve the exact transaction."],
      ["Signer", "Sign", "Your signer runs its own policies, then signs."],
      ["Chain", "Settle", "The receipt is matched to what was approved."],
      ["Administrator", "Book", "Ledger entry linked to the record."],
      ["Q² · Prove", "Prove", "One sealed export for the auditor."],
    ],
  },
  {
    id: "payout", label: "A player payout",
    steps: [
      ["Player", "Request", "A verified withdrawal of 4,000 USDT."],
      ["Q² · Check", "Check", "The player's own wallet, inside payout limits."],
      ["Operator", "Approve", "A signed policy, or a person above the threshold."],
      ["Wallet", "Sign", "The hot wallet signs."],
      ["Chain", "Settle", "Matched to the withdrawal."],
      ["Finance", "Reconcile", "Balances agree with authorised payouts."],
      ["Q² · Prove", "Prove", "The pack your regulator asks for."],
    ],
  },
  {
    id: "agent", label: "An agent payment",
    steps: [
      ["Person", "Mandate", "A named person sets scope and limits."],
      ["Agent", "Propose", "The agent drafts a 60,000 USDC payment."],
      ["Q² · Check", "Check", "Above its limit, so it goes to a person."],
      ["Person", "Approve", "A person approves amount and payee."],
      ["Platform", "Execute", "The platform pays on its own rails."],
      ["Rail", "Settle", "Matched to the approval."],
      ["Q² · Prove", "Prove", "Which agent, whose mandate, who approved."],
    ],
  },
];

export const SENDS = [
  ["You", "Authorise every movement"],
  ["AI agents", "Propose, inside a signed mandate"],
  ["Signer", "Holds keys, signs"],
  ["Administrator", "Keeps the books"],
  ["Chain and custody", "Settles"],
];
export const RECEIVES = [
  ["Investors", "See a rule was followed, not your positions"],
  ["Auditor", "One export per movement"],
  ["Bank, regulator, insurer", "A record they can read"],
];

export const PINS = [
  ["The real effect", "Decoded from the transaction, twice"],
  ["The destination's history", "Full address, age, payment history"],
  ["Who asked, with proof", "A person's own key"],
  ["The rule that allows it", "And the source of each number"],
  ["A short expiry", "Approvals cannot be stockpiled"],
];

export const GRADES = [
  { g: "1", k: "ok", h: "A person approved this exact transaction", s: "on their own device", not: "Does not prove the approvers were not coerced or colluding", w: 100, means: "Entitled people signed the exact transaction on their own devices, and every fact came from a source other than the requester.", use: "Loans, redemptions, treasury moves, any change of control" },
  { g: "2", k: "acc", h: "Inside a mandate a person signed", s: "executed by a machine", not: "Does not prove a person looked at this movement", w: 76, means: "The movement fits a mandate entitled people signed, inside its limits, and was executed by an identified system.", use: "Player payouts under a signed payout policy; agent payments inside a mandate" },
  { g: "3", k: "sig", h: "A system says so", s: "low-risk flows only", not: "Does not prove any person intended it", w: 52, means: "An identified system claims authority, with no person's proof attached. Allowed only for low-risk flows.", use: "Sweeps to registered internal addresses" },
  { g: "0", k: "bad", h: "Unproven or mismatched", s: "refused", not: "Refused where Q² checks, flagged where it observes", w: 30, means: "No evidence of authority, or the evidence does not match what executed.", use: "Refused where Q² checks; flagged as it settles where it only observes" },
];

export const LANES = [
  { k: "One stolen login", out: "Refused", t: "bad", why: "Two named people, and never the proposer", long: "The approvals fall short: two named people are needed, and the proposer cannot approve their own movement." },
  { k: "A trusted internal service", out: "Refused", t: "bad", why: "A system's word is not an approval", long: "A system's request alone is not an approval." },
  { k: "The screen an approver sees", out: "Refused", t: "bad", why: "What is signed must match what was approved", long: "Approvals are bound to the exact transaction. One with a different address or amount has no approval behind it, and what the signer signs is compared with what was approved." },
  { k: "A rule or address, changed then used", out: "Refused", t: "bad", why: "A 48-hour wait, and a second person", long: "The change is kept with before and after, waits 48 hours and needs a second person. Its author cannot use it alone." },
  { k: "A payment sent around the workflow", out: "Flagged as it settles", t: "sig", why: "Blocked at the signer with signing-layer enforcement", long: "Flagged as an unmatched movement as it settles. Blocked as well once the signer requires a valid Q² decision (signing-layer enforcement)." },
  { k: "Q² itself", out: "Moves nothing", t: "ok", why: "It holds no key and no approval right", long: "It holds no key and no approval right. Your approvers and your signer's own policies still stand." },
];

export const NINE = [
  "Money swept before it is matched to a subscription",
  "A subscription accepted before screening is recorded",
  "Money swept before the subscription is accepted",
  "A sweep of a different amount from the one accepted",
  "A payment to an unregistered address",
  "A payment past a concentration limit",
  "Too few approvals, or the proposer approving",
  "A new destination paid inside its cooling-off period",
  "A change of control without the extra approvers",
];

export const SECTORS = [
  { h: "Funds", p: "Prove every movement to auditors and investors.", to: "/funds", cta: "Funds page" },
  { h: "Administrators and transfer agents", p: "Receive the authorisation with the transaction.", to: "/funds", cta: "Funds page" },
  { h: "Tokenisation platforms", p: "Show who authorised each mint, burn and rule change." },
  { h: "iGaming and payments", p: "Every payout tied to a verified withdrawal.", to: "/igaming", cta: "iGaming page" },
  { h: "Platforms running agents", p: "Agents propose. People decide. Banks can check." },
];

export const ADDONS = [
  ["Selective disclosure", "Show a rule was followed without handing over the records"],
  ["Programmable controls", "Your rules written into the account itself"],
  ["Signing-layer enforcement", "The signer signs only with a valid Q² decision"],
  ["Agent gate", "Agents act only inside a mandate a person signed"],
  ["Integration monitoring", "Front ends and integrations checked daily for unexpected change"],
];
export const BASE_RULES = ["Approved counterparties", "Limits on your own figures", "Subscription and payout checks"];
export const BASE_EVIDENCE = ["Movement Record", "Named approvals", "Refusal records", "Bound to your signer", "Rule-change history", "Unmatched-movement alerts", "Evidence export", "Post-quantum seal"];

export const TIMELINE = [
  ["2002", "Internal-control reports", "After the accounting scandals"],
  ["2010s", "Vendor control reports", "Cloud becomes a procurement gate"],
  ["2016", "Bank payment controls", "After forged payment orders"],
  ["2019", "Approval bound to payee", "European payment rules"],
  ["2022", "Proof of reserves", "The assets exist"],
  ["Now", "Proof of authorisation", "Every movement was allowed"],
];

export const HOME_RULES = [
  { where: "EU · DORA standard", when: "In force", quote: "measures to protect logging systems and log information against tampering", gives: "Sealed, tamper-evident records" },
  { where: "EU · MiCA standard", when: "In force", quote: "any suspension or rejection of any instruction", post: " must be on record", gives: "Refusals kept with their reason" },
  { where: "US · SEC proposal", when: "1 Oct 2026", quote: "joint authorization of any crypto asset transactions by at least two people", gives: "Named approvers and quorum" },
  { where: "Global · FSB", when: "15 Oct 2026", quote: "clear, risk-based triggers for when an agent must seek human approval", gives: "Agents propose, people decide" },
];

export const NEVER = ["Hold your keys", "Sign or co-sign", "Approve", "Move funds", "Override a refusal", "Audit or certify", "See investor or player data"];

export const LADDER = [
  { n: "1", h: "Call", meta: "30 minutes · free", p: "We map one of your flows to the six questions. You leave with the gaps and what a pilot would test. No access to your systems or keys." },
  { n: "2", h: "Diagnostic", meta: "2 to 3 weeks · from EUR 5,000", p: "How your movements are approved and evidenced today, against the rules you answer to. Credited to a pilot signed within 60 days." },
  { n: "3", h: "Pilot", meta: "4 weeks · from USD 20,000", p: "One real flow beside your own signer and administrator, with seven pass criteria agreed in writing first." },
  { n: "4", h: "Subscription", meta: "from USD 24,000 a year", p: "Your signer and administrator connected. Never priced per approval." },
];

export const CRITERIA = [
  ["Breaches refused", "Every attempted breach is refused visibly, with the right reason code and an alert. None can be overridden."],
  ["Single compromises caught", "One approver alone, the integration alone, or a rule changed and then used: refused. A payment started directly at the signer: flagged as unmatched."],
  ["Evidence in minutes", "One approved movement produces its complete export in minutes, with no manual step."],
  ["Tamper-evident", "Altering any recorded fact after the event is detected when the record is verified."],
  ["Bound to your signer", "Each signed transaction is bound to its Movement Record, and every signing stage is recorded."],
  ["Time saved, measured", "Time to evidence one movement, measured on your own process before and after."],
  ["No keys or personal data reach Q²", "No key material, credentials or personal data of your investors or customers reach Q²."],
];

export const FAQ = [
  ["Do we change our signer, custodian or administrator?", "No. Q² sits beside them and reads their results. Nothing changes in how the signer signs or how the books are kept."],
  ["What leaves our environment?", "Approvals, check results and transaction references. No keys, no credentials and no personal data of your investors or customers."],
  ["We already have a policy engine and a co-signer. Why this?", "Keep them. They decide whether a transaction fits the platform's rules or looks safe. They cannot see your own business rules or your other providers, and each hands you its own log. Q² proves who decided, under your rules, across all of them."],
  ["Does every movement need a person?", "No. Movements inside a mandate a person signed can run automatically and are graded 2. Low-risk internal sweeps can run on a system's word and are graded 3. The grade tells the reader which is which."],
  ["Who sees the record?", "You decide. Auditors and investors receive the exports you release. With selective disclosure, an investor can be shown that a rule was followed without seeing the underlying records."],
  ["Can Q² make our assets quantum-resilient?", "Your records are sealed for it today. For the assets themselves, ask us about accounts you control. One risk stays with every provider until the networks upgrade."],
  ["Is this an audit?", "No. It is evidence your auditor can test. Q² does not audit, attest or certify."],
  ["What does a pilot need from us?", "Four weeks, one real flow, read-only connections to your signer and administrator, and the people who approve that flow."],
];
