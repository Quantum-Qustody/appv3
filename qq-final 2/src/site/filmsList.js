// The ten demo films from the Q² Demo Storyboard v2.0 (13 Nov 2026).
// One question, one answer, one place on the website and in the whitepaper.
// Shared by the home page ("Watch it work") and the /demo page. The scenes
// themselves live in films.jsx.

export const FILMS = [
  { n: "01", slug: "one-record", title: "One movement, one record", dur: "1:10", question: "Who approved that?", asker: "An auditor", end: "Who approved that? Prove it in minutes.", control: "A complete audit trail per transaction, with authorisation evidenced before execution", wp: "04" },
  { n: "02", slug: "refused", title: "Refused, with a reason", dur: "1:00", question: "Can't someone just send it to a new address?", asker: "An investor's diligence team", end: "What fails a check never reaches the signer.", control: "A preventive check against approved counterparties and concentration limits", wp: "07" },
  { n: "03", slug: "proposer", title: "The proposer cannot approve", dur: "0:50", question: "What if it is one of us?", asker: "A managing partner", end: "Two named people. Never the proposer.", control: "Segregation of duties and dual authorisation", wp: "07" },
  { n: "04", slug: "approver-sees", title: "What the approver sees", dur: "1:15", question: "What did I actually sign?", asker: "An approver, the morning after", end: "People approve what will really happen.", control: "Informed approval bound to the exact transaction; a higher bar for changes of control", wp: "05" },
  { n: "05", slug: "system-word", title: "A system's word is not an approval", dur: "1:00", question: "The system said it was approved.", asker: "An operations lead", end: "The record never vouches for a claim.", control: "Evidence weighed by its source", wp: "06" },
  { n: "06", slug: "rule-change", title: "Change the rule, then try to use it", dur: "1:00", question: "Who changed the limit?", asker: "A risk officer", end: "Changes to authority wait, and need a second person.", control: "Change management; cooling-off; change-then-use detection", wp: "07" },
  { n: "07", slug: "went-around", title: "The payment that went around", dur: "0:50", question: "What if they go around us?", asker: "A security lead", end: "No record behind it? Flagged as it settles.", control: "Completeness: every outflow reconciled to an authorisation", wp: "07" },
  { n: "08", slug: "evidence", title: "Evidence in minutes", dur: "1:00", question: "Can you send me the evidence by Friday?", asker: "An auditor", end: "One sealed export per movement.", control: "Audit evidence on request, from a record the executing systems did not write", wp: "04" },
  { n: "09", slug: "tamper", title: "Change one fact and it shows", dur: "0:45", question: "How do I know nobody edited this?", asker: "A regulator", end: "Change one fact and it shows.", control: "Integrity of records; logs protected against alteration", wp: "09" },
  { n: "10", slug: "no-keys", title: "Compromise Q², move nothing", dur: "0:50", question: "Aren't you one more thing to hack?", asker: "A security lead", end: "Q² holds no keys. Taking it over moves nothing.", control: "Least privilege for a third party; no new path to the money", wp: "03" },
];

// The worked example used everywhere: site, whitepaper, films, platform.
export const EXAMPLE = {
  fund: "Example Credit Fund",
  wallet: "Fund wallet A",
  nav: "64,500,000",
  record: "MR-7F3A-0921",
  amount: "2,000,000 USDC",
  borrower: "Borrower X",
  proposer: "J. Alvarez",
  approvers: ["M. Okoro", "S. Lindqvist"],
  rule: "Mandate v12 · 3.1% of a 4% limit",
  ledger: "LE-44812",
  address: "0x51d2 9a3e 04bc 7f18 c2d6 e90a 5b37 1f4d 88e2 77c0",
};
