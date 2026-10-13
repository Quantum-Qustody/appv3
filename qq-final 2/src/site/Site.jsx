import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import "./site.css";
import { Lockup } from "../brand/Logo.jsx";
import Landing from "./Landing.jsx";
import BrandPage from "./BrandPage.jsx";

// Heavier or rarely visited views load on demand.
const ResearchIndex = lazy(() => import("./Research.jsx").then((m) => ({ default: m.ResearchIndex })));
const ResearchArticle = lazy(() => import("./Research.jsx").then((m) => ({ default: m.ResearchArticle })));
const DesignPartnerPage = lazy(() => import("../designPartner.jsx"));

const TITLES = {
  "/": "Q² · Decision assurance for agentic finance",
  "/research": "Research · Q²",
  "/brand": "Brand · Q²",
  "/design-partner": "Design partner intake · Q²",
};

const usePath = () => {
  const [path, setPath] = useState(() => window.location.pathname.replace(/\/+$/, "") || "/");
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname.replace(/\/+$/, "") || "/");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const go = useCallback((to) => {
    const [p, hash] = to.split("#");
    const target = p || "/";
    if (target !== window.location.pathname) window.history.pushState({}, "", target + window.location.search + (hash ? `#${hash}` : ""));
    setPath(target);
    requestAnimationFrame(() => {
      if (hash) document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
      else window.scrollTo({ top: 0 });
    });
  }, []);
  return [path, go];
};

function Nav({ path, go, enterPlatform }) {
  const [open, setOpen] = useState(false);
  const onHome = path === "/";
  const anchor = (id) => (e) => {
    e.preventDefault();
    setOpen(false);
    if (onHome) document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    else go(`/#${id}`);
  };
  const toResearch = (e) => { e.preventDefault(); setOpen(false); go("/research"); };
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);
  return (
    <header className="nav">
      <div className="nav__in">
        <a className="nav__brand" href="/" onClick={(e) => { e.preventDefault(); setOpen(false); go("/"); }} aria-label="Q Squared, home">
          <Lockup size={28} />
        </a>
        <nav aria-label="Primary">
          <ul className="nav__links">
            <li><a href="/#how" onClick={anchor("how")}>How it works</a></li>
            <li><a href="/#pricing" onClick={anchor("pricing")}>Pricing</a></li>
            <li><a href="/#developers" onClick={anchor("developers")}>Developers</a></li>
            <li><a href="/research" onClick={toResearch} aria-current={path.startsWith("/research") ? "page" : undefined}>Research</a></li>
          </ul>
        </nav>
        <div className="nav__cta">
          <button type="button" className="btn btn--quiet" onClick={() => enterPlatform("auth")}>Sandbox sign in</button>
          <a className="btn btn--primary" href="/#partner" onClick={anchor("partner")}><span className="lbl-long">Become a design partner</span><span className="lbl-short" aria-hidden="true">Design partner</span></a>
          <button type="button" className="nav__menu" aria-expanded={open} aria-controls="site-menu" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((v) => !v)}><i /><i /></button>
        </div>
      </div>
      {open && (
        <nav className="menu" id="site-menu" aria-label="Menu">
          <a href="/#how" onClick={anchor("how")}>How it works</a>
          <a href="/#pricing" onClick={anchor("pricing")}>Pricing</a>
          <a href="/#developers" onClick={anchor("developers")}>Developers</a>
          <a href="/research" onClick={toResearch}>Research</a>
          <button type="button" onClick={() => { setOpen(false); enterPlatform("auth"); }}>Sandbox sign in</button>
        </nav>
      )}
    </header>
  );
}

function Footer({ go, enterPlatform }) {
  const to = (p) => (e) => { e.preventDefault(); go(p); };
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot__grid">
          <div>
            <Lockup size={28} />
            <p className="foot__lede">The decision assurance layer for agentic finance. Approve, record and seal every movement of digital assets.</p>
          </div>
          <div>
            <h2>Product</h2>
            <ul>
              <li><a href="/#how" onClick={to("/#how")}>How it works</a></li>
              <li><a href="/#pricing" onClick={to("/#pricing")}>Pricing</a></li>
              <li><a href="/#developers" onClick={to("/#developers")}>Developers</a></li>
              <li><a href="/#partner" onClick={to("/#partner")}>Design partner programme</a></li>
              <li><button type="button" onClick={() => enterPlatform("auth")}>Sandbox sign in</button></li>
            </ul>
          </div>
          <div>
            <h2>Company</h2>
            <ul>
              <li><a href="/research" onClick={to("/research")}>Research</a></li>
              <li><a href="/brand" onClick={to("/brand")}>Brand</a></li>
              <li><a href="/design-partner" onClick={to("/design-partner")}>Design Partner</a></li>
              <li><a href="mailto:info@quantumqustody.com">info@quantumqustody.com</a></li>
            </ul>
          </div>
          <div>
            <h2>Follow</h2>
            <ul>
              <li><a href="https://www.linkedin.com/company/quantumqustody/" target="_blank" rel="noopener noreferrer">LinkedIn</a></li>
              <li><a href="https://x.com/quantumqustody" target="_blank" rel="noopener noreferrer">X</a></li>
              <li><a href="https://www.instagram.com/quantumqustody/" target="_blank" rel="noopener noreferrer">Instagram</a></li>
            </ul>
          </div>
        </div>
        <div className="foot__base">
          <span>© 2026 Q Squared. Operated by Quantum Qustody Inc., a Delaware corporation.</span>
          <span>Early stage. Design partner programme open.</span>
        </div>
      </div>
    </footer>
  );
}

const Fallback = () => <div style={{ minHeight: "60vh" }} aria-busy="true" />;

export default function Site({ enterPlatform }) {
  const [path, go] = usePath();

  useEffect(() => {
    const base = path.startsWith("/research") ? "/research" : path.startsWith("/brand") ? "/brand" : path;
    document.title = TITLES[base] || TITLES["/"];
    document.documentElement.removeAttribute("data-theme");
  }, [path]);

  // Honour /#section links on first load.
  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (h) setTimeout(() => document.getElementById(h)?.scrollIntoView({ block: "start" }), 50);
  }, []);

  // The Design Partner intake keeps its own interface and gate.
  if (path === "/design-partner") {
    return (
      <div className="ink-surface">
        <Suspense fallback={<Fallback />}>
          <DesignPartnerPage onBack={() => go("/")} onSandbox={() => enterPlatform("auth")} />
        </Suspense>
      </div>
    );
  }

  let view;
  if (path === "/") view = <Landing go={go} enterPlatform={enterPlatform} />;
  else if (path === "/research") view = <Suspense fallback={<Fallback />}><ResearchIndex go={go} /></Suspense>;
  else if (path.startsWith("/research/")) view = <Suspense fallback={<Fallback />}><ResearchArticle id={path.split("/")[2]} go={go} /></Suspense>;
  else if (path === "/brand" || path.startsWith("/brand/")) view = <BrandPage />;
  else view = (
    <main id="main" className="section" style={{ borderTop: 0 }}>
      <div className="wrap sh"><h1 style={{ fontSize: "var(--text-3xl)" }}>Page not found</h1><p><a href="/" onClick={(e) => { e.preventDefault(); go("/"); }}>Go to the home page</a></p></div>
    </main>
  );

  return (
    <div className="site">
      <a className="skip-link" href="#main">Skip to content</a>
      <Nav path={path} go={go} enterPlatform={enterPlatform} />
      {view}
      <Footer go={go} enterPlatform={enterPlatform} />
    </div>
  );
}
