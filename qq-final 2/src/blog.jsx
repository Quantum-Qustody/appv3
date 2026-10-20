// ╔═══════════════════════════════════════════════════════════════════╗
// ║   Blog — glassy responsive section + procedural quantum covers     ║
// ║   + full article reading pages. Self-contained, no DB dependency.  ║
// ╚═══════════════════════════════════════════════════════════════════╝
import { useState, useEffect } from "react";

// ─── Articles ──────────────────────────────────────────────────────
// Each post drives a card (cover + writer + title) and a reading page.
// `seed` makes a deterministic-but-unique quantum cover. `body` is an
// ordered list of blocks: {h} heading, {p} paragraph, {q} pull-quote.
export const BLOG_POSTS = [
  {
    id: "who-approved-that",
    title: "Who approved that?",
    author: "Q² Research",
    role: "",
    date: "2026-10-14",
    readMins: 3,
    seed: 311,
    tag: "Evidence",
    excerpt: "Every digital-asset movement eventually meets the same question, and most firms answer it by reconstruction. This is what independent evidence of authority looks like instead.",
    body: [
      { h: "The question behind every audit" },
      { p: "Every digital-asset movement eventually meets the same question: who approved that? An auditor asks it during year-end fieldwork. An investor's due-diligence team asks it before an allocation. A regulator may ask it after an incident. The question is simple. For most firms, answering it is not." },
      { p: "Take a fund. Before each audit or due-diligence round, the chief operating officer, or someone on that team, assembles the answer by hand. Screenshots from a custodian portal. A spreadsheet of approvals kept by the operations desk. Chat threads in which a portfolio manager wrote “approved” beneath a transfer request. Exports from a signing tool that show which device signed, but not why. Each piece is genuine. Together they are a reconstruction, built after the fact by the people whose decisions are being examined." },
      { h: "Why platform logs are not proof" },
      { p: "The usual reply is that the platform keeps logs. It does, and they matter. But a log written by a vendor about its own system is a statement by that vendor. It records what the platform saw, in the platform's terms, stored where the platform controls it. It cannot speak to an approval given in a chat thread, a policy agreed at an investment committee, or a movement that ran through a second custodian. When several custodians, signers and, increasingly, software agents are involved, each holds a partial account of the same decision." },
      { p: "Evidence of authority has to be independent of the systems it describes. Otherwise the auditor is asked to trust the party under review to describe its own conduct accurately." },
      { q: "A log tells you what a system did. A record of authority tells you who allowed it, and under which rules." },
      { h: "What independent evidence looks like" },
      { p: "An authority record answers a fixed set of questions for every movement. Who proposed it, whether a person or an agent. Who approved it, and in what role. Which mandate, and which version of which policy, was in force at that moment. What was actually executed, and whether it matched what was approved. The same applies to movements that were refused: the record keeps the proposal, the refusal and the reason, because a control that never says no cannot be shown to work." },
      { p: "Each entry is linked to the one before it by a cryptographic hash. If an entry is altered or removed later, the chain no longer verifies, so the change is detectable. The record is tamper-evident: the claim is that interference can be seen, not that it cannot be attempted. Entries are sealed with hybrid signatures, classical and post-quantum together (FIPS 204), and re-sealed as algorithms retire, so the proof can stay checkable for as long as the record must be kept." },
      { h: "Readable without your tools" },
      { p: "The last requirement is the one most often missed. An auditor should be able to read and verify the record without logging into your internal systems, learning a vendor's console or taking your staff's word for what a screen means. If verification depends on the reviewed firm's own tooling, the evidence is not independent in any useful sense." },
      { h: "Where Q² sits" },
      { p: "Q² is designed to be that record: one account of who approved each digital-asset movement, under which mandate and policy, across every custodian, signer and agent a firm uses. It never holds keys and never moves money. It records authority alongside the systems that do. Most of these capabilities are in a testnet sandbox or in design, and nothing is in production. The aim is plain: the next time someone asks who approved that, the answer is a record, not a reconstruction." },
      { p: "Sources: NIST FIPS 204, Module-Lattice-Based Digital Signature Standard (August 2024)." },
    ],
  },
  {
    id: "sec-custody-proposal-two-person",
    title: "What the SEC's crypto custody proposal asks advisers to prove",
    author: "Q² Research",
    role: "",
    date: "2026-10-13",
    readMins: 4,
    seed: 412,
    tag: "Regulation",
    excerpt: "The SEC's October proposal would require self-custody arrangements to address joint authorisation of crypto asset transactions by at least two people. Here is what an adviser would need to evidence.",
    body: [
      { h: "A proposal, not yet a rule" },
      { p: "On 1 October 2026 the SEC published Release IA-7023, a proposal on how SEC-registered investment advisers and regulated funds hold crypto assets. It is a proposal: comments close on 7 December 2026, and any final rule may differ. The release covers several topics, including quarterly statements and an accountant's report. This note looks at one provision, because it turns a common operating habit into something an adviser would have to evidence." },
      { h: "The two-person provision" },
      { p: "Proposed Rule 223-1(b)(7)(ii) addresses self-custody, where the adviser holds crypto assets itself. Under the proposal, self-custody must “address private key management and joint authorization of any crypto asset transactions by at least two people”." },
      { p: "Two parts of that sentence carry the weight. The first is key management: how keys are generated, stored and recovered. The second is joint authorisation by at least two people for any transaction. Many advisers already require two approvals in practice. The proposal would make the requirement explicit, and an examiner could reasonably expect to see how it is enforced and how it is shown." },
      { q: "A policy that says two people approve is a statement. A record that shows which two people approved, before the key signed, is evidence." },
      { h: "What an adviser would need to evidence" },
      { p: "Read plainly, an adviser relying on self-custody would want to show, for any transaction, four things: that at least two people authorised it; who those people were, and that they were entitled to approve; that their approvals came before the signature, not after; and that the transaction executed was the one they approved. A process in which one person signs and a second confirms afterwards over chat is hard to describe as joint authorisation. So is a setup where two approvals are expected but the signer would sign with one." },
      { p: "The adviser would also need to keep that evidence. Existing SEC Rule 204-2(g)(3) already requires advisers to “reasonably safeguard” records “from loss, alteration, or destruction”, and to limit access to authorised personnel. Approval evidence that lives in screenshots and chat exports is difficult to safeguard in that sense, and harder still to show as unaltered." },
      { h: "How a quorum and a record map to it" },
      { p: "Two controls map to the provision. The first is a quorum enforced before the key signs: the signing step does not proceed until the required number of eligible people have approved that specific transaction, under the policy in force. This makes joint authorisation a property of the system rather than a habit of the team." },
      { p: "The second is a record of who approved. Each proposal, approval, refusal and execution is written to a hash-chained, tamper-evident record, sealed with signatures and readable by an examiner or auditor without the adviser's internal tools. That record maps to the safeguarding expectation in Rule 204-2(g)(3), because alteration of any entry becomes detectable, and it gives the adviser a direct answer when asked who authorised a given transaction." },
      { h: "What this does not settle" },
      { p: "Neither control settles the question on its own. Whether an arrangement meets a final rule is a matter for the adviser, its counsel and, in time, the SEC. What the controls do is turn joint authorisation from something an adviser asserts into something it can show. Q² is designed to provide the record and to sit alongside the signer that enforces the quorum. It does not hold keys or move assets, and these capabilities are in a testnet sandbox or in design, not in production." },
      { p: "Sources: SEC Release IA-7023, proposed rule, 1 October 2026 (https://www.sec.gov/files/rules/proposed/2026/ia-7023.pdf). 17 CFR 275.204-2, books and records to be maintained by investment advisers (https://www.ecfr.gov/current/title-17/chapter-II/part-275/section-275.204-2)." },
    ],
  },
  {
    id: "dora-logging-for-digital-assets",
    title: "DORA's logging rule, read for digital assets",
    author: "Q² Research",
    role: "",
    date: "2026-10-12",
    readMins: 4,
    seed: 517,
    tag: "Regulation",
    excerpt: "DORA's ICT risk standard and MiCA's record-keeping rules were written for finance in general. Read for digital assets, they describe a protected, attributable record that includes refused transfers.",
    body: [
      { h: "Rules written for all of finance" },
      { p: "DORA, the EU Digital Operational Resilience Act, has applied since 17 January 2025. Its ICT risk management standard, Delegated Regulation (EU) 2024/1774, has been in force since 15 July 2024. Both bind EU financial entities, including crypto-asset service providers (CASPs), investment firms and alternative investment fund managers. The texts were written for financial services as a whole, so they say nothing specific about wallets, signers or on-chain transfers. Read for digital assets, a few provisions become very concrete." },
      { h: "Logs protected from the people they describe" },
      { p: "Article 12(2)(d) of the standard requires that logging include “measures to protect logging systems and log information against tampering, deletion, and unauthorised access”. For a firm moving digital assets, the most important log is the one that says who instructed and who approved each transfer. If that log sits inside the same platform, administered by the same staff whose actions it records, protection against tampering and deletion is hard to demonstrate." },
      { p: "A practical reading is that approval records should be tamper-evident: any later change to an entry should be detectable by someone who did not make it. Hash-chaining entries and sealing them with signatures does that. It does not stop an administrator from trying. It means the attempt shows." },
      { q: "The test is not whether a log exists. It is whether the people it describes could change it without anyone noticing." },
      { h: "Segregation and identifiable users" },
      { p: "Article 21(1) of the same standard covers access control. Point (b) requires “the segregation of duties designed to prevent unjustified access to critical data”. Point (c) requires “ensuring that users are identifiable for the actions performed in the ICT systems at all times”. In a digital-asset setting, the person who proposes a transfer should not be the only person who can approve it, and every proposal and approval should be attributable to a named individual, not to a shared service account or an API key several people use. Where software agents propose transfers, the agent should be identifiable too, as should the person or signed policy that approved what it proposed." },
      { h: "MiCA adds the refused instruction" },
      { p: "For CASPs, MiCA adds its own record-keeping layer. Article 68(9) of MiCA requires CASPs to keep records “of all crypto-asset services, activities, orders, and transactions” for five years, and up to seven where the competent authority asks. The record-keeping standard, Delegated Regulation (EU) 2025/1140, in force since 30 June 2025, requires in Article 2(1)(c) that records are kept so that “it is not possible to manipulate or alter the records”. Its Annex includes “any suspension or rejection of any instruction to carry out the transfer of crypto-assets”." },
      { p: "That last item is easy to overlook. Most systems record what happened. Fewer keep a durable record of what was stopped and why. A refused transfer, with the policy that refused it and the reason given, is part of the record a CASP should be able to produce." },
      { h: "What this adds up to" },
      { p: "Taken together, these provisions describe a record of digital-asset movements that is protected against tampering and deletion, attributes every action to an identifiable person or agent, reflects segregation between proposing and approving, includes refusals, and is kept for at least five years. A hash-chained, sealed record of who proposed, who approved, under which policy, and what was executed or refused maps to that description. Q² is designed to keep such a record across custodians and signers without holding keys or moving assets. The capabilities are in a testnet sandbox or in design, and none is in production." },
      { p: "Sources: Delegated Regulation (EU) 2024/1774, DORA ICT risk management standard (https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32024R1774). Delegated Regulation (EU) 2025/1140, MiCA record-keeping standard (https://eur-lex.europa.eu/eli/reg_del/2025/1140/oj). Regulation (EU) 2023/1114, Markets in Crypto-Assets (https://eur-lex.europa.eu/eli/reg/2023/1114/oj)." },
    ],
  },
  {
    id: "agents-propose-people-decide",
    title: "Agents propose, people decide",
    author: "Q² Research",
    role: "",
    date: "2026-10-11",
    readMins: 3,
    seed: 623,
    tag: "Agents",
    excerpt: "Software agents are starting to initiate digital-asset movements. An agent may propose; only a person, or a policy a person signed, should approve, and every step should be on record.",
    body: [
      { h: "Agents are starting to move money" },
      { p: "Software agents are beginning to do work that used to need a person at a keyboard: rebalancing treasury positions, paying invoices, moving collateral between venues. In digital assets the step from recommendation to execution is short, because a signed transaction is final once it settles. That is why the question of who decides matters more here than in most places agents are used." },
      { h: "What the FSB consultation says" },
      { p: "On 10 June 2026 the Financial Stability Board published a consultation, “Sound Practices for Responsible Adoption of AI”. It is non-binding, and the final report is due in October 2026. The consultation notes that actions taken by agents can be “difficult or impossible for humans” to undo. Among the practices it observes are “human approval or dual authorisation for transactions above a certain value” and “maintaining audit trails of agent transactions”." },
      { p: "Neither practice is new. Dual authorisation and audit trails are long-standing controls for payments. What the consultation does is make clear that they still apply when the party initiating a transaction is software, and that the difficulty of undoing some agent actions makes them more important, not less." },
      { h: "Agents propose, people decide" },
      { p: "The model that follows is simple to state. An agent may propose a movement. Only a person, or a policy that a person signed, may approve it. A signed policy is a decision made in advance by named people: for example, that transfers below a set value to approved addresses may proceed without a fresh approval. When an agent acts within that policy, the approval is still traceable to the people who signed it. When it does not, the proposal waits for a person or is refused." },
      { q: "An agent can be trusted to propose. Authority to approve belongs to people, or to rules that people signed." },
      { p: "Every step goes on the record: the agent's proposal, with the agent identified; the approval, with the person or the signed policy version that granted it; any refusal, with its reason; and what was executed. That gives an audit trail of agent transactions in the sense the consultation describes, and it shows where human approval or dual authorisation applied." },
      { h: "Why spend limits are not enough" },
      { p: "Many wallet providers now offer spend limits for agents: a daily cap, an allow-list of addresses. These are useful guardrails. They are not a record of decision. A limit configured inside one provider shows what that provider would permit, not who set the limit, under which mandate, or who approved a specific movement above it. Firms that use several custodians or signers end up with several sets of limits, each documented in a different console, and no single account of what was authorised." },
      { h: "What this means in practice" },
      { p: "Before agents are allowed to initiate movements, a firm should be able to answer three questions for any transaction an agent touched: what did the agent propose, who or what approved it, and was the executed transaction the one approved. If the answers depend on the agent's own logs, the record is written by the party being reviewed. Q² is designed to keep that record independently, across custodians, signers and agents, without holding keys or moving money. The capabilities are in a testnet sandbox or in design, not in production." },
      { p: "Sources: Financial Stability Board, “Sound Practices for Responsible Adoption of AI”, consultation, 10 June 2026 (https://www.fsb.org/uploads/P100626.pdf)." },
    ],
  },
  {
    id: "beyond-custody",
    title: "Beyond Custody: Why Governed Movement Is the Real Institutional Primitive",
    author: "Gianluca Di Bella",
    role: "CTO",
    date: "2026-05-12",
    readMins: 6,
    seed: 17,
    tag: "Thesis",
    excerpt: "Custody keeps keys safe. Institutions need something more: the ability to prove every movement was authorised, within policy, and defensible to an auditor.",
    body: [
      { h: "The question custody never answered" },
      { p: "For a decade, digital-asset custody has optimised one thing: keeping private keys out of the wrong hands. Multi-sig, MPC, HSMs, cold storage: all variations on the same promise. Your keys are safe. But ask a treasury officer, a risk lead, or an auditor what keeps them up at night, and key safety is rarely the first answer. The harder question is: can you prove that every movement of capital was authorised by the right people, under the right policy, with evidence you can hand to a regulator?" },
      { p: "That is a governance question, not a storage question. And it is the gap Q² was built to close." },
      { q: "Custody protects keys. Q² protects decisions." },
      { h: "Governed movement as a first-class object" },
      { p: "In our model, a movement is not just a signed transaction. It is a record: who requested it, which policy version was in force, which approvers cleared it under what threshold, and what the on-chain outcome was. Each of those becomes institutionally legible evidence, generated as a by-product of the workflow rather than reconstructed after the fact." },
      { p: "The shift sounds subtle. Operationally it is enormous. It turns the audit from an archaeology project into a query." },
      { h: "Why now" },
      { p: "Two forces are converging. Regulation is tightening around demonstrable controls, not just stated intentions. And the cryptographic ground is shifting under everyone's feet as post-quantum standards mature. An operating model that treats governance and crypto-agility as first-class, rather than bolted on, is the only one that survives both." },
    ],
  },
  {
    id: "what-shor-breaks",
    title: "What Shor's Algorithm Actually Breaks",
    author: "Q² Research",
    role: "",
    date: "2026-06-23",
    readMins: 3,
    seed: 233,
    tag: "Technical note",
    excerpt: "Quantum computers do not break everything equally. Understanding exactly which primitive falls, and how, tells you where digital-asset signing is soft, and where it is not.",
    body: [
      { h: "Two algorithms, two very different threats" },
      { p: "The quantum threat to cryptography is usually delivered as a single ominous sentence: quantum computers break encryption. That flattens a distinction that matters enormously in practice. There are two relevant quantum algorithms, and they do very different things. Grover's algorithm gives a quadratic speed-up against symmetric ciphers and hash functions: meaningful, but answered simply by doubling key and digest sizes. AES-256 and SHA-384 remain comfortable. Shor's algorithm is the earthquake: it solves integer factorisation and discrete logarithms in polynomial time, and those are the exact problems that RSA, Diffie-Hellman, and elliptic-curve cryptography are built on." },
      { p: "For digital assets, the relevant casualty is elliptic-curve cryptography, specifically ECDSA over the secp256k1 curve, the scheme that secures Bitcoin, Ethereum, and nearly every EOA in existence. Shor's algorithm reduces recovering a private key from its public key from computationally impossible to merely a matter of running a sufficiently large machine." },
      { q: "The private key was never the exposed surface. The public key is. Shor collapses the distance between them." },
      { h: "The signature is the soft target" },
      { p: "This reframes where the risk lives. A funded address whose public key has never appeared on-chain is, for now, shielded behind a hash: you cannot run Shor against a key you have not seen. But the moment that address signs a transaction, its public key is published to the ledger forever. From then on, its security rests entirely on the elliptic-curve assumption. Address reuse, therefore, is not merely a privacy smell; in a post-quantum frame it is the difference between a key that has been exposed to the future and one that has not." },
      { p: "The window that matters is the interval between a transaction being broadcast and being finalised. An adversary with a fast enough quantum computer could, in principle, observe a pending transaction, derive the private key from the freshly revealed public key, and race a competing transaction that redirects the funds. It is a narrow window today because the machine does not yet exist. It is not narrow forever." },
      { h: "Where this leaves signing design" },
      { p: "If the signature scheme is the soft target, then a serious operating model treats the signing context as something to be rotated, wrapped, and governed rather than trusted to hold for a decade. Post-quantum signature standards give us a replacement path; the operating model is what makes using it routine. The point of understanding Shor precisely is that it tells you to spend your effort on the signature lifecycle, not on the parts of the stack a quantum computer never threatened in the first place." },
    ],
  },
  {
    id: "reading-nist-pqc-standards",
    title: "Reading the NIST Standards: ML-KEM, ML-DSA, and SLH-DSA",
    author: "Q² Research",
    role: "",
    date: "2026-06-16",
    readMins: 3,
    seed: 360,
    tag: "PQC",
    excerpt: "In August 2024, NIST finalised the first three post-quantum standards. Here is what each one is for, and how they apply to a record of authority that must stay verifiable for years.",
    body: [
      { h: "From candidates to FIPS" },
      { p: "For most of the last decade, post-quantum cryptography was a competition: an eight-year NIST process winnowing dozens of submissions. That phase ended on 13 August 2024, when NIST published FIPS 203, 204, and 205 as finalised federal standards. The distinction is not academic. A finalised FIPS is something a regulator can point to, an auditor can ask about, and an engineering team can adopt without betting on a moving target." },
      { p: "Three standards emerged from the process, and it is worth being precise about what each does, because they are not interchangeable." },
      { h: "FIPS 203: ML-KEM, for key exchange" },
      { p: "ML-KEM, the Module-Lattice-Based Key-Encapsulation Mechanism, derives from the algorithm formerly known as CRYSTALS-Kyber. Its job is key establishment: the quantum-safe replacement for the elliptic-curve Diffie-Hellman handshakes that currently secure the transport layer. Wherever two parties need to agree on a shared secret over an untrusted channel, ML-KEM is the standard to use." },
      { h: "FIPS 204 and 205: ML-DSA and SLH-DSA, for signatures" },
      { p: "Signatures get two standards, and the redundancy is deliberate. ML-DSA, the Module-Lattice-Based Digital Signature Algorithm (formerly CRYSTALS-Dilithium), is the general-purpose workhorse: efficient, with reasonable key and signature sizes, and the default choice for most signing. SLH-DSA, the Stateless Hash-Based Digital Signature Algorithm (formerly SPHINCS+), rests on a different and very conservative assumption: the security of hash functions. It is slower and its signatures are larger, but it exists so there is a fallback whose security does not depend on the lattice assumption holding." },
      { q: "A quantum-safe signature is not one algorithm. It is a portfolio, chosen so no single assumption is load-bearing." },
      { h: "Why a record of authority uses a hybrid seal" },
      { p: "Q² is designed to seal each entry in its record of authority with a hybrid signature: a classical signature and a post-quantum signature (FIPS 204) applied together, with a verifier checking both. The classical signature rests on assumptions with decades of scrutiny behind them; the post-quantum signature protects against a future quantum computer. Forging a seal would mean defeating both, so during the transition the record does not depend on either alone." },
      { p: "The hash-based family has a second role. SLH-DSA (FIPS 205) rests on different mathematics from the lattice schemes, which makes it a second, independent signature family. Sealing with both means a record's proof can survive the failure of either family: if a weakness were found in lattice-based signatures, a hash-based seal would still verify, and the reverse. Entries are re-sealed as algorithms retire, so the record can move to new schemes without losing its history. These signatures protect the evidence of who approved what. Q² does not hold keys or move assets, and this work is in design and in a testnet sandbox, not in production." },
      { p: "NIST gave the industry the primitives. The work that remains is applying them so that evidence created today can still be checked after today's algorithms have retired." },
    ],
  },
  {
    id: "migration-has-a-deadline",
    title: "Migration Has a Deadline",
    author: "Q² Research",
    role: "",
    date: "2026-06-09",
    readMins: 3,
    seed: 512,
    tag: "Strategy",
    excerpt: "The dated US post-quantum mandates bind federal agencies, not financial firms. Finance has no dated mandate yet, but the duty to keep cryptography up to date already applies.",
    body: [
      { h: "Read the scope before the date" },
      { p: "Deadlines for post-quantum migration are now written into US policy, and they are often quoted as if they applied to everyone. They do not. Executive Order 14412, signed on 22 June 2026, and OMB Memorandum M-26-15, issued on 24 June 2026, bind US federal agencies. For federal systems they set three dates: post-quantum key establishment by 2030, post-quantum signatures by 2031, and full migration by 2035." },
      { p: "Those dates matter beyond government. Federal agencies buy software and services, and vendors who sell to them will build to the schedule. But a bank, a fund or a crypto-asset service provider is not bound by an order addressed to agencies, and should not describe its own obligations as if it were." },
      { h: "Europe and the G7: expectations, not law" },
      { p: "In Europe, the EU coordinated roadmap for the transition to post-quantum cryptography is non-binding. It asks that high-risk use cases move to post-quantum cryptography “no later than by the end of 2030”. Internationally, the G7 Cyber Expert Group, also without binding force, asked financial firms in January 2026 to inventory their cryptography, prioritising critical systems for migration between 2030 and 2032." },
      { p: "These are expectations from policymakers and supervisors. They are likely to shape supervisory conversations well before they become rules, but they are not rules yet." },
      { q: "Dated mandates arrive for government first and finance next. The duty to keep cryptography up to date applies now." },
      { h: "The binding text that already names quantum" },
      { p: "For EU financial entities, one binding text already addresses the problem. DORA's ICT risk management standard, Delegated Regulation (EU) 2024/1774, requires in Article 6(5) that firms update their cryptography as cryptanalysis develops, and Recital 9 makes clear this extends to developments “including threats from quantum advancements”. It sets no date. It is, today, the only binding EU text that names quantum risk, and it applies now." },
      { p: "The practical effect is that a firm cannot treat post-quantum migration as something to begin when a dated mandate reaches it. Where its cryptography is exposed to developments in cryptanalysis, the duty to act is already in place." },
      { h: "Why the runway is shorter than it looks" },
      { p: "A deadline is the day work must be finished, not the day it begins. Migration starts with an inventory of every place a vulnerable algorithm is used, which most organisations find takes longer than expected. Each system then has to be replaced, tested and re-assured, often across teams and vendors. Financial infrastructure, with long-lived records and heavy assurance requirements, sits at the difficult end of that range. Records with long retention periods need particular care: a signature that must be checked in seven years has to be trustworthy then, not only today." },
      { h: "Crypto-agility is the real deliverable" },
      { p: "The lesson is not to swap one fixed algorithm for another, which recreates the same brittleness at the next transition. The aim is crypto-agility: the ability to change cryptographic primitives as a routine, governed operation. Q² is designed around that idea for its own record of authority, with entries sealed using hybrid post-quantum signatures (FIPS 204) and re-sealed as algorithms retire. This is in a testnet sandbox and in design, not in production." },
      { p: "The conclusion is simple. The duty to keep cryptography up to date exists now. Dated mandates arrive for government first, and finance next." },
    ],
  },
  {
    id: "quantum-safe-loop",
    title: "The Quantum-Safe Loop: EOA Delegation, ZK Verification, and PQC Rotation",
    author: "Sohil Tiwari",
    role: "CEO",
    date: "2026-05-08",
    readMins: 8,
    seed: 42,
    tag: "Architecture",
    excerpt: "Being quantum-safe is not a single primitive. In our design it is a continuous loop: we never hold the key, we prove conditions without disclosure, and we rotate signing material under post-quantum schemes.",
    body: [
      { h: "Not a primitive, a loop" },
      { p: "When people ask whether Q² is 'quantum-resistant', they usually expect a one-word answer about a signature scheme. The honest answer is more interesting: resistance comes from the operating model around movement, not from any single algorithm. Four moving parts form one continuous loop. What follows describes the design; parts of it run in a testnet sandbox, and none of it is in production." },
      { h: "A: EOA delegation" },
      { p: "We never receive or store a private key, and Q² never moves funds. The institution's signer, whether an HSM, an MPC cluster or a hardware wallet, retains the key. In the design, an externally-owned account is delegated under a policy the institution has approved, so the signer acts only on movements that policy permits. The root of trust stays with the institution at every step." },
      { h: "B: ZK selective verification" },
      { p: "Each governance proof, such as threshold met, policy applied or control passed, is designed to be published as a zero-knowledge attestation. An auditor can verify mathematically that the conditions held, without seeing balances, addresses, counterparties, or internal policy text. Disclosure is minimised; verifiability is maximised." },
      { h: "C: PQC key regeneration" },
      { p: "On a configured cadence, the delegated signing context is rotated using hybrid post-quantum signatures (FIPS 204). The rotation is itself designed to be proven via ZK, so external observers can confirm continuity without learning the underlying material. Old keys retire, new keys come online, and the policy chain does not break." },
      { q: "Authorise, execute, attest, re-key, and back to authorise. The delegation itself is governed." },
      { h: "D: The delegation loop" },
      { p: "After each movement, policy is re-evaluated, evidence is sealed with the current keys, the next rotation is scheduled, and the threshold is re-verified. There is no static delegation that an attacker can sit on. Every cycle leaves a defensible record." },
    ],
  },
  {
    id: "team-as-control-surface",
    title: "The Team Screen Is a Security Control, Not a Settings Page",
    author: "Chee Yang",
    role: "COO",
    date: "2026-05-03",
    readMins: 5,
    seed: 73,
    tag: "Product",
    excerpt: "No hidden users. No pending approvers with authority. No approval power without verification and policy inclusion. Here is how the Team page in our sandbox enforces that.",
    body: [
      { h: "Who can move money is a security boundary" },
      { p: "Most products treat user management as an afterthought: a list, an invite button, a remove button. For any system that governs who can approve digital-asset movements, the team roster is one of the most sensitive control surfaces there is. Get it wrong and you have ghost approvers, dormant accounts with live authority, or a single setup user who quietly granted themselves a quorum." },
      { h: "States, not just roles" },
      { p: "Every member carries an explicit state: Pending, Active, Disabled, Expired, or Revoked. Only an Active member in the Approver role counts toward a threshold. A pending invitee, however well-intentioned, is not a quorum member. The Team screen shows all of this in the open: role, state, approval authority, who invited them, when, and last activity." },
      { q: "If you cannot see who holds authority, you do not have governance. You have hope." },
      { h: "Policy as draft, then active" },
      { p: "Setup configures a draft policy, never live authority. Approvers are invited, verify themselves, and only once the required number of Active approvers sign off does the policy version activate. The first user cannot quietly stand up weak controls and start moving funds." },
    ],
  },
  {
    id: "sepolia-sandbox",
    title: "Testing Governance for Real: Inside the Sepolia Sandbox",
    author: "Gianluca Di Bella",
    role: "CTO",
    date: "2026-04-28",
    readMins: 4,
    seed: 91,
    tag: "Engineering",
    excerpt: "Connect a wallet, claim testnet ETH, send a transaction, invite a teammate, watch the evidence assemble itself. The sandbox runs the governance model on a public testnet.",
    body: [
      { h: "A sandbox you can actually drive" },
      { p: "We could have shipped a clickable mock. Instead the evaluation sandbox runs against the Ethereum Sepolia testnet. You connect MetaMask, Coinbase Wallet, Rabby, or Brave; we read your testnet balance straight from the chain; and Send, Swap, and Bridge produce real testnet transactions you can follow on Etherscan." },
      { h: "Two histories, scoped correctly" },
      { p: "The Evaluation Log is bound to your account and survives every refresh and logout. The on-chain transaction history is bound to the connected wallet and read from the chain. Two streams, scoped to match how institutions actually think about their data." },
      { q: "The fastest way to believe a governance model is to operate it yourself." },
      { h: "Where it goes next" },
      { p: "The flow that runs on Sepolia today is the flow we are designing to run against a governed ERC-4337 smart account: funding locked until policy is active, movements gated by the approver set, every change itself governed. That work is in design and not yet in production. The sandbox is not a demo of the idea. It is the idea, running on testnet." },
    ],
  },
];

// ─── Procedural quantum cover ──────────────────────────────────────
// Deterministic SVG art from a seed — orbital rings, particle field,
// glowing core, gradient. Each post gets a distinct, on-brand cover.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTES = [
  ["#a855f7", "#e879f9", "#6366f1"],
  ["#d946ef", "#a855f7", "#22d3ee"],
  ["#818cf8", "#a855f7", "#f0abfc"],
  ["#7c3aed", "#db2777", "#2dd4bf"],
  ["#6366f1", "#0ea5e9", "#a855f7"],
];

export function QuantumCover({ seed = 1, className = "", style = {} }) {
  const rnd = mulberry32(seed * 2654435761);
  const pal = PALETTES[Math.floor(rnd() * PALETTES.length)];
  const [c1, c2, c3] = pal;
  const cx = 100 + (rnd() - 0.5) * 60;
  const cy = 70 + (rnd() - 0.5) * 30;
  const ringCount = 2 + Math.floor(rnd() * 3);
  const rings = Array.from({ length: ringCount }, (_, i) => ({
    rx: 30 + i * 22 + rnd() * 14,
    ry: (30 + i * 22 + rnd() * 14) * (0.32 + rnd() * 0.4),
    rot: rnd() * 180,
    op: 0.5 - i * 0.08,
    col: [c1, c2, c3][i % 3],
  }));
  const particleCount = 14 + Math.floor(rnd() * 14);
  const particles = Array.from({ length: particleCount }, () => ({
    x: rnd() * 280,
    y: rnd() * 160,
    r: 0.6 + rnd() * 2.2,
    op: 0.2 + rnd() * 0.6,
    col: [c1, c2, c3][Math.floor(rnd() * 3)],
  }));
  const gid = `qg${seed}`;
  return (
    <svg viewBox="0 0 280 160" className={className} style={{ display: "block", width: "100%", height: "100%", ...style }} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id={`${gid}-bg`} cx="50%" cy="40%" r="80%">
          <stop offset="0%" stopColor={c1} stopOpacity="0.28" />
          <stop offset="55%" stopColor="#0a0820" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#03040b" stopOpacity="1" />
        </radialGradient>
        <radialGradient id={`${gid}-core`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="35%" stopColor={c2} stopOpacity="0.9" />
          <stop offset="100%" stopColor={c3} stopOpacity="0" />
        </radialGradient>
        <filter id={`${gid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect width="280" height="160" fill={`url(#${gid}-bg)`} />
      {/* faint grid */}
      <g opacity="0.06" stroke="#fff" strokeWidth="0.5">
        {Array.from({ length: 9 }, (_, i) => <line key={`v${i}`} x1={i * 35} y1="0" x2={i * 35} y2="160" />)}
        {Array.from({ length: 6 }, (_, i) => <line key={`h${i}`} x1="0" y1={i * 32} x2="280" y2={i * 32} />)}
      </g>
      {/* orbital rings */}
      <g filter={`url(#${gid}-glow)`}>
        {rings.map((r, i) => (
          <ellipse key={i} cx={cx} cy={cy} rx={r.rx} ry={r.ry} fill="none"
            stroke={r.col} strokeWidth={i === 0 ? 1.4 : 0.9} opacity={r.op}
            transform={`rotate(${r.rot} ${cx} ${cy})`} />
        ))}
      </g>
      {/* particles */}
      {particles.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={p.col} opacity={p.op} />
      ))}
      {/* glowing core */}
      <circle cx={cx} cy={cy} r="26" fill={`url(#${gid}-core)`} />
      <circle cx={cx} cy={cy} r="3.4" fill="#fff" filter={`url(#${gid}-glow)`} />
    </svg>
  );
}

// ─── Card grid (landing section) ───────────────────────────────────
export function BlogSection({ onOpen }) {
  return (
    <section id="insights" className="py-20 md:py-28 px-4">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-center text-sm fm text-fuchsia-500 tracking-widest mb-3">[ INSIGHTS ]</h2>
        <h3 className="text-center text-3xl md:text-4xl font-bold mb-4">From the Q Squared team</h3>
        <p className="text-center text-gray-400 fm text-sm max-w-2xl mx-auto mb-12 md:mb-16">Notes on authority records, governed movement of digital assets, and the post-quantum transition.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {BLOG_POSTS.map((post, i) => (
            <article
              key={post.id}
              onClick={() => onOpen(post)}
              className="glass glass-h cursor-pointer overflow-hidden flex flex-col group"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="relative h-44 overflow-hidden">
                <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105">
                  <QuantumCover seed={post.seed} />
                </div>
                <span className="absolute top-3 left-3 fm text-[10px] px-2 py-1 bg-black/60 border border-purple-500/40 text-purple-200 backdrop-blur-sm">{post.tag}</span>
              </div>
              <div className="p-5 flex flex-col flex-1">
                <h4 className="font-bold text-base leading-snug mb-2 group-hover:text-purple-300 transition-colors">{post.title}</h4>
                <p className="fm text-xs text-gray-400 leading-relaxed mb-4 flex-1">{post.excerpt}</p>
                <div className="flex items-center gap-3 mt-auto pt-3 border-t border-purple-500/10">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {post.author.split(" ").map(s => s[0]).join("").slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className="fm text-xs text-gray-200 truncate">{post.author}</div>
                    <div className="fm text-[10px] text-gray-500">{new Date(post.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {post.readMins} min</div>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Full article reading page ─────────────────────────────────────
export function BlogArticle({ post, onBack, onOpen }) {
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [post?.id]);
  if (!post) return null;
  const others = BLOG_POSTS.filter(p => p.id !== post.id).slice(0, 3);

  return (
    <div className="min-h-screen">
      {/* top bar */}
      <div className="fixed top-0 w-full z-50 p-4">
        <div className="max-w-3xl mx-auto glass rounded-sm flex justify-between items-center px-5 py-3">
          <button onClick={onBack} className="fm text-xs text-gray-300 hover:text-purple-400 transition-colors cursor-pointer flex items-center gap-2">← BACK TO INSIGHTS</button>
          <div className="flex items-center gap-2"><img src="/qq-logo.svg" alt="QQ" className="w-6 h-6" /><span className="font-bold text-sm tracking-tight hidden sm:inline">Q SQUARED</span></div>
        </div>
      </div>

      {/* hero cover */}
      <div className="relative h-[42vh] min-h-[280px] w-full overflow-hidden">
        <QuantumCover seed={post.seed} style={{ position: "absolute", inset: 0 }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(3,4,11,.2), rgba(3,4,11,.95))" }} />
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-8">
          <div className="max-w-3xl mx-auto">
            <span className="fm text-[10px] px-2 py-1 bg-purple-500/20 border border-purple-500/40 text-purple-200">{post.tag}</span>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight mt-4 mb-4 leading-tight">{post.title}</h1>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center text-sm font-bold">
                {post.author.split(" ").map(s => s[0]).join("").slice(0, 2)}
              </div>
              <div>
                <div className="fm text-sm text-gray-200">{post.author}{post.role ? <span className="text-gray-500"> · {post.role}</span> : null}</div>
                <div className="fm text-xs text-gray-500">{new Date(post.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} · {post.readMins} min read</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* body */}
      <article className="px-4 py-12">
        <div className="max-w-2xl mx-auto space-y-6">
          {post.body.map((block, i) => {
            if (block.h) return <h2 key={i} className="text-xl md:text-2xl font-bold text-white pt-4">{block.h}</h2>;
            if (block.q) return (
              <blockquote key={i} className="border-l-2 border-purple-500 pl-5 py-1 my-8">
                <p className="text-lg md:text-xl font-semibold tg leading-snug">{block.q}</p>
              </blockquote>
            );
            return <p key={i} className="text-gray-300 leading-relaxed text-[15px] md:text-base">{block.p}</p>;
          })}
        </div>
      </article>

      {/* more articles */}
      <section className="px-4 py-12 border-t border-purple-500/10">
        <div className="max-w-5xl mx-auto">
          <h3 className="fm text-xs text-fuchsia-500 tracking-widest mb-6">[ MORE INSIGHTS ]</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {others.map(p => (
              <article key={p.id} onClick={() => onOpen(p)} className="glass glass-h cursor-pointer overflow-hidden flex flex-col group">
                <div className="h-28 overflow-hidden"><div className="h-full transition-transform duration-500 group-hover:scale-105"><QuantumCover seed={p.seed} /></div></div>
                <div className="p-4">
                  <h4 className="font-bold text-sm leading-snug mb-2 group-hover:text-purple-300 transition-colors">{p.title}</h4>
                  <div className="fm text-[10px] text-gray-500">{p.author} · {p.readMins} min</div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-purple-500/20 bg-black py-10 px-6 text-center">
        <button onClick={onBack} className="fm text-xs text-purple-400 hover:text-purple-300 cursor-pointer">← BACK TO INSIGHTS</button>
      </footer>
    </div>
  );
}
