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
    id: "harvest-now-decrypt-later",
    title: "Harvest Now, Decrypt Later: The Attack That's Already Running",
    author: "Sohil Tiwari",
    role: "Head of Architecture",
    date: "2026-06-30",
    readMins: 7,
    seed: 128,
    tag: "Quantum",
    excerpt: "The quantum threat to custody is not a future event. Adversaries are recording encrypted traffic and on-chain public keys today, to break them the day a cryptographically-relevant quantum computer arrives.",
    body: [
      { h: "The threat is present tense" },
      { p: "The comforting version of the quantum story goes like this: one day a large quantum computer switches on, and on that day we all move to new cryptography. It is comforting because it puts the risk safely in the future. It is also wrong. The dominant quantum attack against long-lived secrets is happening now, in the present tense, and it requires no quantum computer at all — only patience and cheap storage." },
      { p: "The pattern has a name: harvest now, decrypt later. An adversary records encrypted material today — TLS sessions, key-exchange handshakes, and, for anyone holding digital assets, the public keys and signatures that sit permanently on a public ledger — and files it away. The decryption step waits. When a cryptographically-relevant quantum computer becomes available, the archive is opened retroactively. Everything harvested before that day is exposed after it." },
      { q: "Every secret with a shelf life longer than the road to Q-day is already, functionally, at risk." },
      { h: "Why custody is uniquely exposed" },
      { p: "Most industries worry about harvest-now-decrypt-later for confidentiality: medical records, state secrets, intellectual property that must stay sealed for decades. Custody has a sharper problem. A blockchain is a public, permanent, append-only record of exactly the material an attacker wants. Every spent transaction reveals a public key. Once revealed, that key protects its address only by the assumed hardness of the elliptic-curve discrete-log problem — precisely the assumption a quantum computer running Shor's algorithm dismantles." },
      { p: "So the harvest is not hypothetical for us. It is the chain itself. The data is already collected, already timestamped, already distributed to every node on earth. There is nothing to exfiltrate. The only variable left is the arrival of the machine that reads it." },
      { h: "What acting early actually means" },
      { p: "You cannot un-publish a public key, so the defence is not secrecy — it is agility and rotation. Move value to controls that do not depend on a single classical signature standing forever. Rotate signing material on a cadence, so that even a harvested key protects a shrinking, bounded window. And build the operating model so that changing the underlying cryptography is a routine, governed motion rather than a once-in-a-decade migration crisis. That is the whole thesis behind treating post-quantum readiness as a property of movement, not a property of a single key." },
    ],
  },
  {
    id: "what-shor-breaks",
    title: "What Shor's Algorithm Actually Breaks",
    author: "Sohil Tiwari",
    role: "Head of Architecture",
    date: "2026-06-23",
    readMins: 8,
    seed: 233,
    tag: "Cryptography",
    excerpt: "Quantum computers do not break everything equally. Understanding exactly which primitive falls — and how — tells you precisely where a custody platform is soft, and where it is not.",
    body: [
      { h: "Two algorithms, two very different threats" },
      { p: "The quantum threat to cryptography is usually delivered as a single ominous sentence: quantum computers break encryption. That flattens a distinction that matters enormously in practice. There are two relevant quantum algorithms, and they do very different things. Grover's algorithm gives a quadratic speed-up against symmetric ciphers and hash functions — meaningful, but answered simply by doubling key and digest sizes. AES-256 and SHA-384 remain comfortable. Shor's algorithm is the earthquake: it solves integer factorisation and discrete logarithms in polynomial time, and those are the exact problems that RSA, Diffie-Hellman, and elliptic-curve cryptography are built on." },
      { p: "For digital assets, the relevant casualty is elliptic-curve cryptography — specifically ECDSA over the secp256k1 curve, the scheme that secures Bitcoin, Ethereum, and nearly every EOA in existence. Shor's algorithm reduces recovering a private key from its public key from computationally impossible to merely a matter of running a sufficiently large machine." },
      { q: "The private key was never the exposed surface. The public key is. Shor collapses the distance between them." },
      { h: "The signature is the soft target" },
      { p: "This reframes where the risk lives. A funded address whose public key has never appeared on-chain is, for now, shielded behind a hash — you cannot run Shor against a key you have not seen. But the moment that address signs a transaction, its public key is published to the ledger forever. From then on, its security rests entirely on the elliptic-curve assumption. Address reuse, therefore, is not merely a privacy smell; in a post-quantum frame it is the difference between a key that has been exposed to the future and one that has not." },
      { p: "The window that matters is the interval between a transaction being broadcast and being finalised. An adversary with a fast enough quantum computer could, in principle, observe a pending transaction, derive the private key from the freshly-revealed public key, and race a competing transaction that redirects the funds. It is a narrow window today because the machine does not yet exist. It is not narrow forever." },
      { h: "Where this leaves a custody design" },
      { p: "If the signature scheme is the soft target, then a serious platform treats the signing context as something to be rotated, wrapped, and governed rather than trusted to hold for a decade. Post-quantum signature standards give us a drop-in replacement path; the operating model is what makes using it routine. The point of understanding Shor precisely is that it tells you to spend your effort on the signature lifecycle — not on the parts of the stack a quantum computer never threatened in the first place." },
    ],
  },
  {
    id: "reading-nist-pqc-standards",
    title: "Reading the NIST Standards: ML-KEM, ML-DSA, and SLH-DSA",
    author: "Sohil Tiwari",
    role: "Head of Architecture",
    date: "2026-06-16",
    readMins: 7,
    seed: 360,
    tag: "PQC",
    excerpt: "In August 2024, NIST finalised the first three post-quantum standards. They are no longer research candidates — they are FIPS. Here is what each one is for, and how a custody platform maps onto them.",
    body: [
      { h: "From candidates to FIPS" },
      { p: "For most of the last decade, post-quantum cryptography was a competition — an eight-year NIST process winnowing dozens of submissions. That phase ended on 13 August 2024, when NIST published FIPS 203, 204, and 205 as finalised federal standards. The distinction is not academic. A finalised FIPS is something a regulator can point to, an auditor can require, and an engineering team can adopt without betting on a moving target. The candidates became infrastructure." },
      { p: "Three standards emerged from the process, and it is worth being precise about what each does, because they are not interchangeable." },
      { h: "FIPS 203 — ML-KEM, for key exchange" },
      { p: "ML-KEM, the Module-Lattice-Based Key-Encapsulation Mechanism, derives from the algorithm formerly known as CRYSTALS-Kyber. Its job is key establishment — the quantum-safe replacement for the elliptic-curve Diffie-Hellman handshakes that currently secure the transport layer. Anywhere two parties need to agree on a shared secret over an untrusted channel, ML-KEM is the standard reach." },
      { h: "FIPS 204 and 205 — ML-DSA and SLH-DSA, for signatures" },
      { p: "Signatures get two standards, and the redundancy is deliberate. ML-DSA, the Module-Lattice-Based Digital Signature Algorithm (formerly CRYSTALS-Dilithium), is the general-purpose workhorse: efficient, with reasonable key and signature sizes, and the default choice for most signing. SLH-DSA, the Stateless Hash-Based Digital Signature Algorithm (formerly SPHINCS+), rests on a completely different and very conservative security assumption — the collision resistance of hash functions. It is slower and its signatures are larger, but it exists precisely so there is a fallback whose security does not depend on the lattice assumption holding. Two standards, two independent mathematical foundations, so a break in one does not leave you stranded." },
      { q: "A quantum-safe signature is not one algorithm. It is a portfolio, chosen so no single assumption is load-bearing." },
      { h: "Mapping the platform onto the standards" },
      { p: "For a custody platform the mapping is direct. The delegated signing context is the thing to migrate onto a post-quantum signature scheme — ML-DSA-65 as the practical default, with the option of a hash-based signature where an institution wants belt-and-braces assurance. The rotation of that signing material, proven so external observers can verify continuity without seeing the keys, is what turns a static standard into a living control. NIST gave the industry the primitives. Turning them into governed, rotating, attestable movement is the work that remains — and it is the work we build." },
    ],
  },
  {
    id: "migration-has-a-deadline",
    title: "Migration Has a Deadline",
    author: "Chee Yang",
    role: "Product",
    date: "2026-06-09",
    readMins: 6,
    seed: 512,
    tag: "Strategy",
    excerpt: "The standards are final and the timelines are now written into policy. Between CNSA 2.0, NSM-10, and the 2026 executive order, the question for institutions is no longer whether to migrate, but whether they can finish in time.",
    body: [
      { h: "The dates are no longer aspirational" },
      { p: "For years, post-quantum migration lived in the conditional tense — something to plan for once the standards settled. The standards have settled, and the deadlines have hardened into policy. National Security Memorandum 10 set 2035 as the target for broad federal adoption of quantum-resistant cryptography. The NSA's CNSA 2.0 suite went further for national-security systems, mandating post-quantum algorithms in new acquisitions from 2027 and full migration by 2035. And in June 2026, Executive Order 14409 pulled the federal government's own internal migration deadline forward from 2035 to 2031." },
      { p: "The trend line is unambiguous: every revision moves the date earlier, not later. Regulators are pricing in the possibility that a cryptographically-relevant quantum computer arrives sooner than the comfortable projections assume, and they are building the schedule around that risk rather than around the median forecast." },
      { q: "No timeline has ever been revised to give institutions more time. Plan for the deadline that keeps moving toward you." },
      { h: "Why the runway is shorter than it looks" },
      { p: "A migration deadline is not the day work begins — it is the day work must already be finished. Cryptographic migration in a large institution is measured in years: you must first inventory every place a vulnerable algorithm is used, which is itself a project most organisations discover they cannot complete quickly. Then you replace, test, and re-certify each one, often across systems whose owners have long since moved on. Financial infrastructure, with its long-lived assets and heavy assurance requirements, sits at the difficult end of that spectrum." },
      { p: "Working back from 2031, and accounting for the years an inventory-and-remediation programme actually takes, the honest start date for many institutions is now. The harvest-now-decrypt-later problem sharpens this further: data and keys exposed today are already on the clock, regardless of when the migration formally completes." },
      { h: "Crypto-agility is the real deliverable" },
      { p: "The lesson institutions are drawing is that the goal is not to swap one fixed algorithm for another fixed algorithm — that just recreates the same brittleness against the next transition. The goal is crypto-agility: the ability to change cryptographic primitives as a routine, governed operation. Build that capability once and the 2031 deadline becomes a configuration change rather than a crisis. That is why we treat rotation and governed movement as first-class from the start — the deadline is a date, but agility is the durable answer to it." },
    ],
  },
  {
    id: "beyond-custody",
    title: "Beyond Custody: Why Governed Movement Is the Real Institutional Primitive",
    author: "Gianluca Di Bella",
    role: "Founder",
    date: "2026-05-12",
    readMins: 6,
    seed: 17,
    tag: "Thesis",
    excerpt: "Custody keeps keys safe. Institutions need something more: the ability to prove every movement was authorised, policy-compliant, and defensible to an auditor.",
    body: [
      { h: "The question custody never answered" },
      { p: "For a decade, digital-asset custody has optimised one thing: keeping private keys out of the wrong hands. Multi-sig, MPC, HSMs, cold storage — all variations on the same promise. Your keys are safe. But ask a treasury officer, a risk lead, or an auditor what keeps them up at night, and key safety is rarely the first answer. The harder question is: can you prove that every movement of capital was authorised by the right people, under the right policy, with evidence you can hand to a regulator?" },
      { p: "That is a governance question, not a storage question. And it is the gap Quantum Qustody was built to close." },
      { q: "Custody protects keys. Quantum Qustody protects decisions." },
      { h: "Governed movement as a first-class object" },
      { p: "In our model, a movement is not just a signed transaction. It is a record: who requested it, which policy version was in force, which approvers cleared it under what threshold, and what the on-chain outcome was. Each of those becomes institutionally legible evidence, generated as a by-product of the workflow rather than reconstructed after the fact." },
      { p: "The shift sounds subtle. Operationally it is enormous. It turns the audit from an archaeology project into a query." },
      { h: "Why now" },
      { p: "Two forces are converging. Regulation is tightening around demonstrable controls, not just stated intentions. And the cryptographic ground is shifting under everyone's feet as post-quantum standards mature. An operating model that treats governance and crypto-agility as first-class — rather than bolted on — is the only one that survives both." },
    ],
  },
  {
    id: "quantum-safe-loop",
    title: "The Quantum-Safe Loop: EOA Delegation, ZK Verification, and PQC Rotation",
    author: "Sohil Tiwari",
    role: "Head of Architecture",
    date: "2026-05-08",
    readMins: 8,
    seed: 42,
    tag: "Architecture",
    excerpt: "Being quantum-safe is not a single primitive. It is a continuous loop: we never hold the key, we prove conditions without disclosure, and we rotate signing material under PQC schemes.",
    body: [
      { h: "Not a primitive — a loop" },
      { p: "When people ask whether Quantum Qustody is 'quantum-resistant', they usually expect a one-word answer about a signature scheme. The honest answer is more interesting: our resistance comes from the operating model around movement, not from any single algorithm. Four moving parts form one continuous loop." },
      { h: "A — EOA delegation" },
      { p: "We never receive or store a private key. The institution's signer — an HSM, an MPC cluster, a hardware wallet — retains it. Quantum Qustody is authorised on an externally-owned account that the policy engine controls. We sign nothing, and authorise nothing, outside policy. The root of trust stays with the institution at every step." },
      { h: "B — ZK selective verification" },
      { p: "Every governance proof — threshold met, policy applied, control passed — is published as a zero-knowledge attestation. An auditor verifies, mathematically, that the conditions held, without ever seeing balances, addresses, counterparties, or internal policy text. Disclosure is minimised; verifiability is maximised." },
      { h: "C — PQC key regeneration" },
      { p: "On a configured cadence, the delegated signing context is rotated under a post-quantum scheme such as ML-DSA-65. The rotation is itself proven via ZK, so external observers confirm continuity without learning the underlying material. Old keys retire, new keys come online, and the policy chain never breaks." },
      { q: "Authorise, execute, attest, re-key — and back to authorise. The delegation itself is governed." },
      { h: "D — The delegation loop" },
      { p: "After each movement, policy is re-evaluated, evidence is sealed with the current keys, the next rotation is scheduled, and the threshold is re-verified. There is no static delegation that an attacker can sit on. Every cycle leaves a defensible record." },
    ],
  },
  {
    id: "team-as-control-surface",
    title: "The Team Screen Is a Security Control, Not a Settings Page",
    author: "Chee Yang",
    role: "Product",
    date: "2026-05-03",
    readMins: 5,
    seed: 73,
    tag: "Product",
    excerpt: "No hidden users. No pending approvers with authority. No approval power without verification and policy inclusion. Here is how we make the Team page enforce that.",
    body: [
      { h: "Who can move money is a security boundary" },
      { p: "Most products treat user management as an afterthought — a list, an invite button, a remove button. For an institutional custody platform, the team roster is one of the most sensitive control surfaces in the entire system. Get it wrong and you have ghost approvers, dormant accounts with live authority, or a single setup user who quietly granted themselves a quorum." },
      { h: "States, not just roles" },
      { p: "Every member carries an explicit state: Pending, Active, Disabled, Expired, or Revoked. Only an Active member in the Approver role counts toward a threshold. A pending invitee — however well-intentioned — is not a quorum member. The Team screen shows all of this in the open: role, state, approval authority, who invited them, when, and last activity." },
      { q: "If you cannot see who holds authority, you do not have governance — you have hope." },
      { h: "Policy as draft, then active" },
      { p: "Setup configures a draft policy, never live authority. Approvers are invited, verify themselves, and only once the required number of Active approvers sign off does the policy version activate. The first user cannot quietly stand up weak controls and start moving funds." },
    ],
  },
  {
    id: "sepolia-sandbox",
    title: "Testing Governance for Real: Inside the Sepolia Sandbox",
    author: "Gianluca Di Bella",
    role: "Founder",
    date: "2026-04-28",
    readMins: 4,
    seed: 91,
    tag: "Engineering",
    excerpt: "Connect a wallet, claim testnet ETH, send a transaction, invite a teammate, watch the evidence assemble itself. The sandbox is the pitch, executed live.",
    body: [
      { h: "A sandbox you can actually drive" },
      { p: "We could have shipped a clickable mock. Instead the evaluation sandbox runs against the real Ethereum Sepolia testnet. You connect MetaMask, Coinbase Wallet, Rabby, or Brave; we read your live balance straight from the chain; and Send, Swap, and Bridge produce real on-chain transactions you can follow on Etherscan." },
      { h: "Two histories, scoped correctly" },
      { p: "The Evaluation Log is bound to your account and survives every refresh and logout. The on-chain transaction history is bound to the connected wallet and read live from the chain. Two streams, scoped to match how institutions actually think about their data." },
      { q: "The fastest way to believe a governance model is to operate it yourself." },
      { h: "Where it goes next" },
      { p: "The same flow that runs on Sepolia today is the flow that will run against a governed ERC-4337 smart account tomorrow — funding locked until policy is active, movements gated by the approver set, every change itself governed. The sandbox is not a demo of the idea. It is the idea, running." },
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
        <h3 className="text-center text-3xl md:text-4xl font-bold mb-4">From the Quantum Qustody team</h3>
        <p className="text-center text-gray-400 fm text-sm max-w-2xl mx-auto mb-12 md:mb-16">Notes on governed movement, post-quantum architecture, and building institutional custody that proves itself.</p>
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
          <div className="flex items-center gap-2"><img src="/qq-logo.svg" alt="QQ" className="w-6 h-6" /><span className="font-bold text-sm tracking-tight hidden sm:inline">QUANTUM_QUSTODY</span></div>
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
                <div className="fm text-sm text-gray-200">{post.author} <span className="text-gray-500">· {post.role}</span></div>
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
