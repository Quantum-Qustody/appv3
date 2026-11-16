import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./demo.css";
import { Mark } from "../brand/Logo.jsx";
import { FILMS } from "./filmsList.js";
import { compile, ease, setReducedMotion } from "./films.jsx";

// The ten demo films (Q² Demo Storyboard v2.0), played in the browser. Every
// frame is a pure function of time, so seeking is exact and every take is
// identical. ?film=NN selects a film; ?film=NN&record=1 renders only the
// stage at 1920×1080 for screen recording and sets window.__filmDone at the end.

const W = 1280, H = 720;
const FEATURE = ["01", "03", "04", "02", "06", "05", "07", "08", "09", "10"];
const byN = (n) => FILMS.find((f) => f.n === n) || FILMS[0];
const fmt = (s) => { const v = Math.max(0, Math.floor(s)); return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`; };
const io = (x) => { const v = Math.min(1, Math.max(0, x)); return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2; };

const useReducedMotion = () => {
  const [r, setR] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const m = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!m) return;
    const on = () => setR(m.matches);
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);
  useEffect(() => { setReducedMotion(r); }, [r]);
  return r;
};

/* ── Zoom: push in on the one value that matters, then pull back ── */
function zoomAt(list, lt) {
  for (const z of list || []) {
    const a = z.at + z.in, b = a + z.hold, c = b + z.out;
    if (lt < z.at || lt > c) continue;
    const k = z.in === 0 || lt >= a ? (lt < b ? 1 : 1 - io((lt - b) / z.out)) : io((lt - z.at) / z.in);
    return { s: 1 + (z.s - 1) * k, x: z.x, y: z.y };
  }
  return { s: 1, x: "50%", y: "50%" };
}

/* ── The thread ── */
function threadState(film, t) {
  const st = { show: true, line: 0, lineFrom: 0, lineT: 0, beads: [], brokeT: null, sealT: null, darkFrom: null, darkT: null, strayT: null };
  for (const e of film.ev) {
    if (e.t > t) break;
    if (e.k === "show") st.show = e.v;
    else if (e.k === "line") { st.lineFrom = st.line; st.line = e.v; st.lineT = e.t; }
    else if (e.k === "bead") st.beads.push({ i: e.v, t: e.t });
    else if (e.k === "break") st.brokeT = e.t;
    else if (e.k === "mend") st.brokeT = null;
    else if (e.k === "seal") st.sealT = e.t;
    else if (e.k === "dark") { st.darkFrom = e.v; st.darkT = e.t; }
    else if (e.k === "stray") st.strayT = e.t;
  }
  return st;
}

function Thread({ film, t, reduced }) {
  const st = threadState(film, t);
  const X0 = 64, X1 = 1216, Y = 20;
  const n = film.slots;
  const slotX = (i) => (n === 1 ? X0 + 140 : X0 + 56 + (i * (X1 - X0 - 112)) / (n - 1));
  const lineP = st.lineFrom + (st.line - st.lineFrom) * io((t - st.lineT) / 0.9);
  const lineEnd = X0 + (X1 - X0) * lineP;
  const vis = st.beads.filter((b) => t >= b.t);
  const last = vis.length ? slotX(vis[vis.length - 1].i) : X0 + (lineEnd - X0) * 0.5;
  const broken = st.brokeT !== null;
  const bx = Math.min(lineEnd - 30, last + 54);
  const snap = broken ? (reduced ? 1 : ease((t - st.brokeT) / 0.35)) : 0;
  const darkX = st.darkFrom !== null ? slotX(st.darkFrom) - 30 : null;
  return (
    <svg className={`film__thread${st.show ? "" : " is-hidden"}`} viewBox={`0 0 ${W} 56`} aria-hidden="true">
      {!broken && <line x1={X0} y1={Y} x2={lineEnd} y2={Y} className={`th-line${darkX ? " is-part" : ""}`} />}
      {!broken && darkX && <line x1={darkX} y1={Y} x2={lineEnd} y2={Y} className="th-line is-dark" />}
      {broken && <>
        <line x1={X0} y1={Y} x2={bx - 12} y2={Y} className="th-line is-broken" />
        <g style={{ transform: `rotate(${7 * snap}deg)`, transformOrigin: `${bx + 12}px ${Y}px`, opacity: 1 - 0.55 * snap }}>
          <line x1={bx + 12} y1={Y} x2={bx + 12 + Math.max(40, Math.min(150, lineEnd - bx))} y2={Y} className="th-line is-broken" />
        </g>
        <text x={bx} y={Y - 8} className="th-lbl th-lbl--no" textAnchor="middle">✕ Refused</text>
      </>}
      {film.threadEnd && <g>
        <rect x={X1 - 7} y={Y - 7} width="14" height="14" rx="3" className={`th-end${lineP >= 0.99 && !broken ? " is-reached" : ""}`} />
        <text x={X1} y={Y + 26} className="th-lbl" textAnchor="middle">{film.threadEnd}</text>
      </g>}
      {vis.map((b) => {
        const p = reduced ? 1 : ease((t - b.t) / 0.4);
        const isSeal = st.sealT !== null && t >= st.sealT && b.i === n - 1;
        const dark = st.darkFrom !== null && b.i >= st.darkFrom;
        const x = slotX(b.i);
        return (
          <g key={b.i} style={{ opacity: Math.min(1, p * 1.4) }}>
            {isSeal && <circle cx={x} cy={Y} r="10" className="th-ring" />}
            <circle cx={x} cy={Y - (1 - p) * 16} r="6.5" className={`th-bead${isSeal ? " is-seal" : ""}${dark ? " is-dark" : ""}${broken ? " is-hold" : ""}`} />
            {film.beadLabels && <text x={x} y={Y + 26} className={`th-lbl${isSeal ? " th-lbl--seal" : ""}${dark ? " th-lbl--dark" : ""}`} textAnchor="middle">{film.beadLabels[b.i]}</text>}
          </g>
        );
      })}
      {st.strayT !== null && t >= st.strayT && (() => {
        const p = ease((t - st.strayT) / 0.6);
        const x = slotX(n - 1), y = Y - 6 - 8 * p + (reduced ? 0 : Math.sin(t * 2.2) * 2.5);
        return <g style={{ opacity: p }}>
          <circle cx={x} cy={y} r="6.5" className="th-bead is-stray" />
          <text x={x - 14} y={y + 4} className="th-lbl th-lbl--flag" textAnchor="end">⚑ 15:07 · no record behind it</text>
        </g>;
      })()}
    </svg>
  );
}

/* ── The stage: one 1280×720 canvas, scaled to fit ── */
function Scene({ scene, lt, film, n }) {
  if (scene.kind === "cold") {
    const p = ease(lt / 0.9);
    return (
      <div className="film__cold" style={{ opacity: p }}>
        <p className="film__q">“{scene.q}”</p>
        <p className="film__who">{scene.who}</p>
      </div>
    );
  }
  if (scene.kind === "end") {
    return (
      <div className="film__end">
        <p className="film__endline" style={{ opacity: ease((lt - 0.2) / 0.8) }}>{scene.line}</p>
        <div className="film__endsig" style={{ opacity: ease((lt - 1.2) / 0.8) }}>
          <Mark size={44} title="Q Squared" />
          <span className="mono">quantumqustody.com</span>
        </div>
        <span className="film__endn mono" style={{ opacity: ease((lt - 1.6) / 0.8) }}>Film {n} · {film.title}</span>
      </div>
    );
  }
  const S = scene.S;
  return <div className="film__screen"><S lt={lt} /></div>;
}

function Stage({ meta, film, t, reduced, fit, poster, onPosterPlay }) {
  const i = Math.max(0, film.scenes.findLastIndex((s) => t >= s.start));
  const cur = film.scenes[i];
  const lt = t - cur.start;
  const prev = i > 0 && !cur.cut && lt < 0.45 ? film.scenes[i - 1] : null;
  const fade = prev ? ease(lt / 0.45) : 1;
  const z = reduced ? { s: 1, x: "50%", y: "50%" } : zoomAt(cur.zoom, lt);
  const drift = !reduced && cur.drift ? cur.drift.y * io((lt - cur.drift.from) / (cur.drift.to - cur.drift.from)) : 0;
  const cap = cur.kind === "screen" || !cur.kind ? cur.cap : null;
  return (
    <div className="film__canvas" style={{ transform: `scale(${fit})` }}>
      {prev && (
        <div className="film__layer" style={{ opacity: 1 - fade }}>
          <Scene scene={prev} lt={t - prev.start} film={meta} n={meta.n} />
        </div>
      )}
      <div className="film__layer" style={{ opacity: fade }}>
        <div className="film__zoom" style={{ transform: `translateY(${drift}px) scale(${z.s})`, transformOrigin: `${z.x} ${z.y}` }}>
          <Scene scene={cur} lt={lt} film={meta} n={meta.n} />
        </div>
      </div>
      {cap && <div className="film__cap" key={cap} style={{ opacity: ease(lt / 0.35) }}>{cap}</div>}
      <Thread film={film} t={t} reduced={reduced} />
      {poster && (
        <button type="button" className="film__poster" onClick={onPosterPlay} aria-label={`Play film ${meta.n}, ${meta.title}`}>
          <span className="film__posterq">“{meta.question}”</span>
          <span className="film__playbig" aria-hidden="true"><svg width="34" height="34" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor" /></svg></span>
          <span className="film__postert mono">Film {meta.n} · {meta.title} · {meta.dur}</span>
        </button>
      )}
    </div>
  );
}

const useFit = (ref, record) => {
  const [fit, setFit] = useState(0.5);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const calc = () => {
      if (record) { setFit(Math.min(window.innerWidth / W, window.innerHeight / H)); return; }
      const w = el.clientWidth;
      setFit(w / W);
      setNarrow(w < 560);
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    window.addEventListener("resize", calc);
    return () => { ro.disconnect(); window.removeEventListener("resize", calc); };
  }, [ref, record]);
  return [fit, narrow];
};

/* ── The player ── */
function Player({ meta, autoStart, onEnded, record }) {
  const film = useMemo(() => compile(meta.slug), [meta.slug]);
  const reduced = useReducedMotion();
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const stageRef = useRef(null);
  const wrapRef = useRef(null);
  const tRef = useRef(0);
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;
  const [fit, narrow] = useFit(stageRef, record);

  const seek = useCallback((v) => { const c = Math.min(film.total, Math.max(0, v)); tRef.current = c; setT(c); }, [film.total]);

  // New film: rewind; play straight away only when asked.
  useEffect(() => {
    tRef.current = 0; setT(0);
    setPlaying(!!autoStart); setStarted(!!autoStart);
  }, [meta.slug, autoStart]);

  // The clock.
  useEffect(() => {
    if (!playing) return;
    let raf, last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const next = tRef.current + dt;
      if (next >= film.total) {
        tRef.current = film.total; setT(film.total); setPlaying(false);
        endedRef.current?.();
        return;
      }
      tRef.current = next; setT(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, film.total]);

  // Pause when scrolled off screen.
  useEffect(() => {
    if (record) return;
    const el = stageRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const ob = new IntersectionObserver(([e]) => { if (!e.isIntersecting) setPlaying(false); }, { threshold: 0.2 });
    ob.observe(el);
    return () => ob.disconnect();
  }, [record]);

  const toggle = () => {
    setStarted(true);
    if (!playing && tRef.current >= film.total) seek(0);
    setPlaying((p) => !p);
  };
  const restart = () => { setStarted(true); seek(0); setPlaying(true); };
  const onKey = (e) => {
    if (e.target.closest?.("a")) return;
    if (e.key === " " || e.key === "k") { e.preventDefault(); toggle(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); setStarted(true); seek(tRef.current + 5); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); setStarted(true); seek(tRef.current - 5); }
    else if (e.key === "Home") { e.preventDefault(); seek(0); }
  };

  // Click or drag on the progress bar to seek.
  const barRef = useRef(null);
  const seekFromPointer = (e) => {
    const r = barRef.current.getBoundingClientRect();
    setStarted(true);
    seek(((e.clientX - r.left) / r.width) * film.total);
  };
  const onBarDown = (e) => {
    e.preventDefault();
    seekFromPointer(e);
    const move = (ev) => seekFromPointer(ev);
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Screen-recording mode.
  useEffect(() => {
    if (!record) return;
    window.__filmDone = false;
    window.__filmTotal = film.total;
    window.__filmScenes = film.scenes.map((s) => ({ start: s.start, d: s.d, kind: s.kind || "screen", cap: s.cap || s.q || s.line }));
    // For stills: window.__filmSeek(seconds) pauses and jumps; ?autoplay=0 holds at 0.
    window.__filmSeek = (s) => { setPlaying(false); seek(s); };
    document.documentElement.style.overflow = "hidden";
    let alive = true;
    const hold = new URLSearchParams(window.location.search).get("autoplay") === "0";
    (document.fonts?.ready || Promise.resolve()).then(() => setTimeout(() => { if (alive && !hold) { setStarted(true); setPlaying(true); } }, 500));
    return () => { alive = false; document.documentElement.style.overflow = ""; };
  }, [record, film.total]);
  useEffect(() => { if (record && t >= film.total) window.__filmDone = true; }, [record, t, film.total]);

  const cur = film.scenes[Math.max(0, film.scenes.findLastIndex((s) => t >= s.start))];
  const subs = cur.kind === "cold" ? `“${cur.q}”` : cur.kind === "end" ? cur.line : cur.cap;

  if (record) {
    return (
      <div className="film film-rec" ref={stageRef}>
        <div className="film__stage film__stage--rec" style={{ width: W * fit, height: H * fit }}>
          <Stage meta={meta} film={film} t={t} reduced={false} fit={fit} />
        </div>
      </div>
    );
  }

  return (
    <div className={`film${narrow ? " is-narrow" : ""}${reduced ? " is-reduced" : ""}`} ref={wrapRef} onKeyDown={onKey}>
      <div className="film__stage" ref={stageRef} tabIndex={0} role="region" aria-label={`Film ${meta.n}: ${meta.title}. Space plays or pauses, arrow keys seek.`} onClick={(e) => { if (!e.target.closest(".film__poster")) toggle(); }}>
        <Stage meta={meta} film={film} t={t} reduced={reduced} fit={fit} poster={!started} onPosterPlay={(e) => { e.stopPropagation(); toggle(); }} />
      </div>
      <p className="film__subs" aria-live={playing ? "polite" : "off"}>{started ? subs : `“${meta.question}”`}</p>
      <div className="film__ctrl">
        <button type="button" className="film__btn" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
          {playing
            ? <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor" /></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>}
        </button>
        <button type="button" className="film__btn" onClick={restart} aria-label="Restart">
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z" fill="currentColor" /></svg>
        </button>
        <div className="film__bar" ref={barRef} onPointerDown={onBarDown} role="slider" tabIndex={0}
          aria-label="Seek" aria-valuemin={0} aria-valuemax={Math.round(film.total)} aria-valuenow={Math.round(t)} aria-valuetext={`${fmt(t)} of ${fmt(film.total)}`}>
          <div className="film__fill" style={{ width: `${(t / film.total) * 100}%` }} />
          {film.scenes.slice(1).map((s) => <i key={s.start} className="film__tick" style={{ left: `${(s.start / film.total) * 100}%` }} />)}
        </div>
        <span className="film__time mono">{fmt(t)} / {fmt(film.total)}</span>
      </div>
    </div>
  );
}

/* ── The page ── */
const readFilm = () => {
  try { const q = new URLSearchParams(window.location.search); return { n: q.get("film"), record: q.get("record") === "1" }; }
  catch { return { n: null, record: false }; }
};

export default function DemoPage({ go }) {
  const init = useMemo(readFilm, []);
  const [n, setN] = useState(() => (FILMS.some((f) => f.n === init.n) ? init.n : "01"));
  const [auto, setAuto] = useState(false);
  const [queue, setQueue] = useState(null); // index into FEATURE while playing all
  const [run, setRun] = useState(0); // remounts the player on every pick
  const meta = byN(n);
  const playerRef = useRef(null);

  const choose = (next, autoplay = true, keepQueue = false) => {
    setN(next); setAuto(autoplay); setRun((r) => r + 1);
    if (!keepQueue) setQueue(null);
    try {
      const q = new URLSearchParams(window.location.search);
      q.set("film", next);
      window.history.replaceState(window.history.state, "", `${window.location.pathname}?${q.toString()}`);
    } catch { /* ignore */ }
  };

  const pick = (f) => {
    choose(f.n, true);
    playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const playAll = () => {
    setQueue(0);
    choose(FEATURE[0], true, true);
    playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onEnded = useCallback(() => {
    if (queue === null) return;
    const nx = queue + 1;
    if (nx >= FEATURE.length) { setQueue(null); return; }
    setTimeout(() => { setQueue(nx); choose(FEATURE[nx], true, true); }, 1200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue]);

  if (init.record) return <Player meta={meta} autoStart={false} record />;

  const toWp = (wp) => (e) => { e.preventDefault(); go(`/whitepaper#s${wp}`); };

  return (
    <main id="main" className="lp page demo">
      <section className="section-x page__top" aria-labelledby="demo-title">
        <div className="wrap">
          <div className="head">
            <h1 id="demo-title">Demo films.</h1>
            <p>Ten films of about a minute, one claim each, all following one loan: 2,000,000 USDC from Example Credit Fund to Borrower X. Names are invented.</p>
          </div>

          <div className="demo__player" ref={playerRef}>
            <div className="demo__top">
              <div className="demo__now">
                <span className="mono">Film {meta.n} · {meta.dur}</span>
                <h2>{meta.title}</h2>
              </div>
              <div className="demo__all">
                {queue !== null
                  ? <>
                      <span className="demo__chip mono" aria-live="polite">Playing all · {queue + 1} of {FEATURE.length}</span>
                      <button type="button" className="demo__link" onClick={() => setQueue(null)}>Stop after this film</button>
                    </>
                  : <button type="button" className="demo__btn" onClick={playAll}>
                      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
                      Play all · about ten minutes
                    </button>}
              </div>
            </div>
            <Player key={run} meta={meta} autoStart={auto} onEnded={onEnded} />
            <div className="demo__meta">
              <p><span className="demo__k">Asked by</span>{meta.asker}</p>
              <p><span className="demo__k">Control, in the client's terms</span>{meta.control}</p>
              <p><a href={`/whitepaper#s${meta.wp}`} onClick={toWp(meta.wp)}>Read whitepaper section {meta.wp} <span aria-hidden="true">→</span></a></p>
            </div>
          </div>

          <h2 className="demo__h">All ten films</h2>
          <ol className="demo__grid">
            {FILMS.map((f) => (
              <li key={f.n}>
                <button type="button" className={`demo__card${f.n === n ? " is-on" : ""}`} aria-current={f.n === n ? "true" : undefined} onClick={() => pick(f)}>
                  <span className="demo__th">
                    <span className="demo__no mono">{f.n}</span>
                    <span className="demo__q">“{f.question}”</span>
                    <span className="demo__pl" aria-hidden="true"><svg width="11" height="11" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor" /></svg></span>
                  </span>
                  <b>{f.title}</b>
                  <span className="mono demo__d">{f.dur} · {f.asker}</span>
                  <span className="demo__end">{f.end}</span>
                </button>
                <a className="demo__wp" href={`/whitepaper#s${f.wp}`} onClick={toWp(f.wp)}>Read whitepaper section {f.wp}</a>
              </li>
            ))}
          </ol>
          <p className="demo__note">Screens show the worked example used across the site and the whitepaper. Names, amounts, addresses and record numbers are illustrative. Reason codes are placeholders.</p>
        </div>
      </section>
    </main>
  );
}
