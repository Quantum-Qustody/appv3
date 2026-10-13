// Scroll choreography for the landing page. Everything here is progressive:
// content is fully visible without it, and none of it runs when the visitor
// prefers reduced motion. Reveals use IntersectionObserver; scrubbed effects
// use GSAP ScrollTrigger, loaded after first paint.
//
//   [data-reveal]        fade and rise into view (optional data-reveal-delay in ms)
//   [data-scrub-words]   words light up one by one (grey to white) as the paragraph scrolls through
//   [data-scale-in]      grows from 0.86 to 1 while entering, dims while leaving
//   [data-count]         counts up to its number once, when it enters
//   [data-stack] > *     cards stack: earlier cards shrink back as the next arrives
//   [data-hero]          hero copy lifts and fades as the page scrolls away
//   [data-progress]      fills to the scroll progress of its data-progress target

const prefersReduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function reveals(root) {
  const els = root.querySelectorAll("[data-reveal]");
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const d = Number(e.target.dataset.revealDelay || 0);
      e.target.style.transitionDelay = `${d}ms`;
      e.target.classList.add("is-in");
      io.unobserve(e.target);
    }
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  els.forEach((el) => io.observe(el));
  return () => io.disconnect();
}

function counters(root) {
  const els = root.querySelectorAll("[data-count]");
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      const el = e.target;
      const end = Number(el.dataset.count);
      const dur = 1400;
      const t0 = performance.now();
      const step = (now) => {
        const k = Math.min((now - t0) / dur, 1);
        const eased = 1 - Math.pow(1 - k, 3);
        el.textContent = String(Math.round(end * eased));
        if (k < 1) requestAnimationFrame(step);
      };
      el.textContent = "0";
      requestAnimationFrame(step);
    }
  }, { threshold: 0.6 });
  els.forEach((el) => io.observe(el));
  return () => io.disconnect();
}

function splitWords(el) {
  if (el.dataset.split) return el.querySelectorAll(".w");
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
          else { const s = document.createElement("span"); s.className = "w"; s.textContent = part; frag.appendChild(s); }
        });
        node.replaceChild(frag, child);
      } else if (child.nodeType === 1) walk(child);
    }
  };
  walk(el);
  el.dataset.split = "1";
  return el.querySelectorAll(".w");
}

export function initMotion(root) {
  if (!root || prefersReduced()) return () => {};
  document.documentElement.classList.add("motion-on");
  const offs = [reveals(root), counters(root)];
  let ctx = null;
  let dead = false;

  (async () => {
    const [{ gsap }, { ScrollTrigger }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);
    if (dead) return;
    gsap.registerPlugin(ScrollTrigger);
    ctx = gsap.context(() => {
      root.querySelectorAll("[data-scrub-words]").forEach((p) => {
        // Colour, not opacity: the dim state is the caption grey, so every
        // frame of the effect still passes WCAG AA contrast.
        const words = splitWords(p);
        const cs = getComputedStyle(p);
        const dim = cs.getPropertyValue("--q-ink-3").trim() || "#A29CBA";
        const lit = cs.getPropertyValue("--q-ink").trim() || "#F4F2FB";
        const acc = cs.getPropertyValue("--q-accent").trim() || "#AE9CFF";
        gsap.fromTo(words, { color: dim }, {
          color: (i, el) => (el.closest("strong") ? acc : lit), ease: "none", stagger: 0.08,
          scrollTrigger: { trigger: p, start: "top 82%", end: "bottom 42%", scrub: 0.6 },
        });
      });

      root.querySelectorAll("[data-scale-in]").forEach((el) => {
        gsap.fromTo(el, { scale: 0.86, opacity: 0.4 }, {
          scale: 1, opacity: 1, ease: "none",
          scrollTrigger: { trigger: el, start: "top 95%", end: "top 45%", scrub: 0.5 },
        });
      });

      root.querySelectorAll("[data-hero]").forEach((el) => {
        gsap.to(el, {
          yPercent: -18, opacity: 0.05, ease: "none",
          scrollTrigger: { trigger: el.closest("section") || el, start: "top top", end: "bottom 20%", scrub: 0.4 },
        });
      });

      root.querySelectorAll("[data-stack]").forEach((stack) => {
        const cards = [...stack.children];
        cards.forEach((card, i) => {
          const next = cards[i + 1];
          if (!next) return;
          gsap.to(card.firstElementChild || card, {
            scale: 0.92, opacity: 0.45, ease: "none",
            scrollTrigger: { trigger: next, start: "top 85%", end: "top 30%", scrub: 0.4 },
          });
        });
      });

      root.querySelectorAll("[data-progress]").forEach((bar) => {
        const target = document.getElementById(bar.dataset.progress);
        if (!target) return;
        gsap.fromTo(bar, { scaleY: 0 }, {
          scaleY: 1, ease: "none", transformOrigin: "top center",
          scrollTrigger: { trigger: target, start: "top 60%", end: "bottom 60%", scrub: 0.3 },
        });
      });
    }, root);
    // Images and fonts change heights after load.
    window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true });
  })().catch(() => {});

  return () => { dead = true; offs.forEach((f) => f()); ctx?.revert(); document.documentElement.classList.remove("motion-on"); };
}

// Pointer spotlight on cards: sets --mx / --my in px for a radial highlight.
export function spotlight(e) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
}
