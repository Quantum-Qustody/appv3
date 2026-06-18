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
    author: "Sohil Patel",
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
