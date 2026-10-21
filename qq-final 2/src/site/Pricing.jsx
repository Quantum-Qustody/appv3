import { useEffect, useRef } from "react";
import { Pill } from "./Landing.jsx";
import { initMotion, spotlight } from "./motion.js";

// The entry ladder from the pricing strategy (v4), as set out in the website
// review of 13 Oct 2026. "From" prices leave room to learn. Never priced per
// approval or per transaction.
const PLANS = [
  {
    name: "Sandbox", price: "Free", unit: "",
    body: "Try the approval and record flow on testnet. Self-serve.",
    items: ["Ethereum Sepolia testnet", "Quorum approvals and authority records", "Preview API"],
    cta: "Open the sandbox", action: "sandbox",
  },
  {
    name: "Diagnostic", from: true, price: "EUR 5,000", unit: "",
    body: "Two to three weeks. We map how your movements are approved and evidenced today, against the rules you answer to.",
    items: ["A written map of approvals and evidence", "Mapped against the rules you answer to", "Synthetic data only; no access to your systems or keys", "Credited to a pilot signed within 60 days"],
    cta: "Book a diagnostic call", action: "start",
  },
  {
    name: "Pilot", from: true, price: "USD 20,000", unit: "", featured: true,
    body: "Eight to twelve weeks on one real flow, with written success criteria.",
    items: ["One real flow, bounded scope", "Success criteria agreed in writing", "Part of the fee credited to year one when you subscribe"],
    cta: "Talk to us", action: "start",
  },
  {
    name: "Subscription", from: true, price: "USD 24,000", unit: "a year",
    body: "One entity, your signer and administrator connected, evidence packs, the post-quantum seal.",
    items: ["Reviewers unlimited", "Never priced per approval", "Evidence packs on demand"],
    cta: "Talk to us", action: "start",
  },
];

export default function PricingPage({ go, enterPlatform }) {
  const root = useRef(null);
  useEffect(() => initMotion(root.current), []);
  const act = (a) => (e) => { e.preventDefault(); if (a === "sandbox") enterPlatform("auth"); else go("/#start"); };

  return (
    <main id="main" ref={root} className="lp page">
      <section className="section-x page__top" aria-labelledby="pricing-title">
        <div className="wrap">
          <div className="head" data-reveal>
            <h1 id="pricing-title">Pricing.</h1>
            <p>Start free, then move up one step at a time. Each step is priced so you can stop after it.</p>
          </div>
          <div className="plans">
            {PLANS.map((p, i) => (
              <article key={p.name} className={`tier-card shell ${p.featured ? "is-featured" : ""}`} data-reveal data-reveal-delay={i * 80} onPointerMove={spotlight} aria-labelledby={`plan-${i}`}>
                <div className="shell__core">
                  <h2 id={`plan-${i}`} className="tier-card__name">{p.name}</h2>
                  <p className="tier-card__price">{p.from && <span className="tier-card__from">From</span>}<b>{p.price}</b>{p.unit && <span> {p.unit}</span>}</p>
                  <p className="tier-card__lede">{p.body}</p>
                  <ul>{p.items.map((it) => <li key={it}>{it}</li>)}</ul>
                  <Pill href={p.action === "sandbox" ? "/" : "/#start"} onClick={act(p.action)} variant={p.featured ? "primary" : "ghost"}>{p.cta}</Pill>
                </div>
              </article>
            ))}
          </div>
          <p className="plans__context" data-reveal>For most funds, less than the cost of your administrator, and a fraction of what you pay to evidence controls by hand.</p>
          <p className="plans__fine">Prices exclude tax. A diagnostic is quoted in euros, pilots and subscriptions in US dollars.</p>
        </div>
      </section>
    </main>
  );
}
