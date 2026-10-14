// The rules, in their own words. Each quote is taken from the cited text; the
// "gives" line is what Q² produces against it ("maps to", never "complies with").
// Source: Q² website review, 13 Oct 2026, section 5. Keep quotes verbatim.

export const RULES = [
  {
    id: "dora-12",
    rule: "DORA ICT risk standard",
    cite: "Delegated Regulation (EU) 2024/1774, Art. 12(2)(d)",
    quote: "measures to protect logging systems and log information against tampering, deletion, and unauthorised access",
    gives: "Signed, append-only, hash-chained records: tampering is detectable.",
    status: "In force",
    binds: "In force since 15 Jul 2024; DORA applies from 17 Jan 2025. EU financial entities, including CASPs, investment firms and AIFMs.",
    url: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32024R1774",
    home: true,
  },
  {
    id: "dora-21",
    rule: "DORA ICT risk standard",
    cite: "Delegated Regulation (EU) 2024/1774, Art. 21(1)(b) and (c)",
    quote: "the segregation of duties designed to prevent unjustified access to critical data; ensuring that users are identifiable for the actions performed in the ICT systems at all times",
    gives: "Proposer and approver kept separate; every person or agent named on each act.",
    status: "In force",
    binds: "As Art. 12 above.",
    url: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32024R1774",
  },
  {
    id: "dora-6",
    rule: "DORA ICT risk standard",
    cite: "Delegated Regulation (EU) 2024/1774, Art. 6(5) and Recital 9",
    quote: "for updating or changing, where necessary, the cryptographic technology … including threats from quantum advancements",
    gives: "A crypto-agile seal: records re-sealed as algorithms retire.",
    status: "In force",
    binds: "As Art. 12 above. The only binding EU text that names quantum risk today.",
    url: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32024R1774",
  },
  {
    id: "mica-rts",
    rule: "MiCA record-keeping standard",
    cite: "Delegated Regulation (EU) 2025/1140, Art. 2(1)(c) and Annex",
    quote: "it is not possible to manipulate or alter the records … any suspension or rejection of any instruction to carry out the transfer of crypto-assets",
    gives: "Unalterable records, including refused movements with the reason.",
    status: "In force",
    binds: "In force since 30 Jun 2025. Binds EU CASPs.",
    url: "https://eur-lex.europa.eu/eli/reg_del/2025/1140/oj",
    home: true,
  },
  {
    id: "mica-68",
    rule: "MiCA",
    cite: "Regulation (EU) 2023/1114, Art. 68(9)",
    quote: "of all crypto-asset services, activities, orders, and transactions",
    gives: "Per-movement records kept for the retention period: five years, up to seven if the authority asks.",
    status: "In force",
    binds: "Fully applicable since 30 Dec 2024; transitional period ended 1 Jul 2026. EU CASPs.",
    url: "https://eur-lex.europa.eu/eli/reg/2023/1114/oj",
  },
  {
    id: "sec-223",
    rule: "SEC crypto custody proposal",
    cite: "Release IA-7023, 1 Oct 2026, proposed Rule 223-1(b)(7)(ii)",
    quote: "address private key management and joint authorization of any crypto asset transactions by at least two people",
    gives: "A quorum enforced before your key signs, and a record of who approved.",
    status: "Proposal",
    binds: "Comments close 7 Dec 2026. SEC-registered advisers and regulated funds.",
    url: "https://www.sec.gov/files/rules/proposed/2026/ia-7023.pdf",
    home: true,
  },
  {
    id: "sec-204",
    rule: "SEC books-and-records rule",
    cite: "Rule 204-2(g)(3)",
    quote: "reasonably safeguard … from loss, alteration, or destruction",
    gives: "Tamper-evident records with access control and export.",
    status: "In force",
    binds: "SEC-registered advisers.",
    url: "https://www.ecfr.gov/current/title-17/chapter-II/part-275/section-275.204-2",
  },
  {
    id: "fsb",
    rule: "FSB AI sound practices",
    cite: "Consultation, 10 Jun 2026",
    quote: "human approval or dual authorisation for transactions above a certain value … maintaining audit trails of agent transactions",
    gives: "Agents propose; only people or a signed policy approve; every agent proposal is on record.",
    status: "Consultation",
    binds: "Non-binding; final report due October 2026.",
    url: "https://www.fsb.org/uploads/P100626.pdf",
    home: true,
  },
  {
    id: "gdpr",
    rule: "GDPR",
    cite: "Regulation (EU) 2016/679, Art. 25(2)",
    quote: "only personal data which are necessary for each specific purpose of the processing are processed",
    gives: "Selective disclosure shows a reader only what they need.",
    status: "In force",
    binds: "Anyone processing EU personal data.",
    url: "https://eur-lex.europa.eu/eli/reg/2016/679/oj",
  },
];

// Where the rules are heading: three lanes, four periods. The first column is
// what already applies. Only rules that bear on approval, records or cryptography.
export const PERIODS = ["Applies now", "Late 2026", "2027 to 2029", "2030 and after"];
export const LANES = [
  {
    name: "Approval and authorisation",
    cells: [
      ["DORA: segregation of duties, identifiable users"],
      ["FSB final report on AI agents, due Oct", "SEC two-person authorisation proposal, comments close 7 Dec"],
      ["SEC custody rule, if adopted"],
      [],
    ],
  },
  {
    name: "Record keeping",
    cells: [
      ["DORA: logs protected against tampering", "MiCA RTS 2025/1140: unalterable records, rejections included", "MiCA Art. 68(9): five to seven years", "SEC Rule 204-2"],
      [],
      [],
      [],
    ],
  },
  {
    name: "Cryptography",
    cells: [
      ["DORA: update cryptography as cryptanalysis develops, quantum named", "EO 14412 and OMB M-26-15: dates set for US federal agencies only"],
      [],
      ["G7 Cyber Expert Group: inventory cryptography (non-binding)"],
      ["US federal: key establishment 2030, signatures 2031, full migration 2035", "EU roadmap: high-risk use cases by end of 2030 (non-binding)", "G7: critical systems 2030 to 2032 (non-binding)"],
    ],
  },
];
