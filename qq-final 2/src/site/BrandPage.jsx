import { useEffect } from "react";
import { Mark } from "../brand/Logo.jsx";
import { FigShares, FigQuorum, FigChain, FigLattice } from "./Figures.jsx";

const ASSETS = [
  { file: "q2-mark.svg", name: "Mark", bg: "paper", w: 120, h: 120 },
  { file: "q2-mark-dark.svg", name: "Mark, dark", bg: "ink", w: 120, h: 120 },
  { file: "q2-lockup-horizontal.svg", name: "Horizontal lockup", bg: "paper", w: 212, h: 64 },
  { file: "q2-lockup-horizontal-dark.svg", name: "Horizontal lockup, dark", bg: "ink", w: 212, h: 64 },
  { file: "q2-lockup-stacked.svg", name: "Stacked lockup", bg: "paper", w: 160, h: 124 },
  { file: "q2-lockup-stacked-dark.svg", name: "Stacked lockup, dark", bg: "ink", w: 160, h: 124 },
];

const SWATCHES = [
  { v: "--q-brand-purple", name: "Q² Purple", hex: "#5B3BEA", use: "Mark, links, primary action, focus" },
  { v: "--q-brand-paper", name: "Paper", hex: "#FBFAFD", use: "Page background" },
  { v: "--q-brand-ink", name: "Ink", hex: "#15112B", use: "Text, rules, dark surfaces" },
  { v: "--q-brand-signal", name: "Signal", hex: "#F2B04A", use: "Approved and sealed only. Under 5% of any page" },
];

const FIGS = [
  { C: FigShares, name: "Key shares", note: "f(x) = s + a₁x + a₂x². Shares are points on f; f(0) = s is the key." },
  { C: FigQuorum, name: "Quorum", note: "Approve when Σ vᵢ ≥ k. The agent proposes, it never votes." },
  { C: FigChain, name: "Record", note: "hᵢ = H(hᵢ₋₁ ‖ rᵢ). Each record commits to the one before it." },
  { C: FigLattice, name: "Seal", note: "t = A·s₁ + s₂ (mod q). The module lattice behind ML-DSA." },
];

const EXPLORATIONS = [
  { file: "a-signature-seal.svg", name: "A · Signature seal", note: "The tail runs out as a signature line and ends in a seal.", picked: true },
  { file: "b-nib.svg", name: "B · Nib", note: "A tapered pen stroke. Rejected: it reads as a speech bubble or a map pin." },
  { file: "c-stamp.svg", name: "C · Stamp", note: "A Q inside a document stamp. Rejected: it reads as a search icon." },
];

function Section({ id, title, lede, children }) {
  return (
    <section className="section" id={id} aria-labelledby={`${id}-t`}>
      <div className="wrap">
        <div className="sh"><h2 id={`${id}-t`}>{title}</h2>{lede && <p>{lede}</p>}</div>
        {children}
      </div>
    </section>
  );
}

export default function BrandPage() {
  useEffect(() => {
    if (window.location.pathname.startsWith("/brand/explorations")) {
      document.getElementById("explorations")?.scrollIntoView();
    }
  }, []);

  return (
    <main id="main">
      <section className="hero" aria-labelledby="brand-title">
        <div className="wrap">
          <div className="sh" style={{ marginBottom: 0 }}>
            <h1 id="brand-title" style={{ fontSize: "var(--text-display)", fontWeight: 600, letterSpacing: "-0.03em" }}>Brand</h1>
            <p>Q Squared, written Q². The mark is a Q that signs. Its tail runs out as the line you sign on and ends in a seal. It stands for the three things Q² does: approve, record, seal.</p>
          </div>
        </div>
      </section>

      <Section id="logos" title="Mark and lockups" lede="Hand-drawn SVG on a 64-unit grid. Use the light files on Paper and the dark files on Ink. Do not redraw or recolour them.">
        <div className="bp-grid">
          {ASSETS.map((a) => (
            <figure className="bp-tile" key={a.file} style={{ margin: 0 }}>
              <div className={`bp-tile__art bp-tile__art--${a.bg}`}><img src={`/brand/${a.file}`} alt={a.name} width={a.w} height={a.h} /></div>
              <figcaption><span>{a.name}</span><a href={`/brand/${a.file}`} download>{a.file}</a></figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section id="clearspace" title="Clear space" lede="Keep a margin equal to the seal's diameter (one fifth of the mark's height) on every side. Nothing else enters that space.">
        <div className="clearspace">
          <div style={{ outline: "1px dashed var(--q-brand-purple)", outlineOffset: 0, padding: 26, color: "var(--q-brand-purple)" }}>
            <div style={{ outline: "1px solid color-mix(in srgb, var(--q-brand-purple) 30%, transparent)" }}><Mark size={128} title="Q² mark with clear space" /></div>
          </div>
        </div>
      </Section>

      <Section id="minsize" title="Minimum size" lede="The mark holds down to 16 px. Below 24 px the superscript 2 is dropped, as in the favicon. The horizontal lockup needs at least 100 px of width.">
        <div className="minsize">
          {[96, 48, 32, 24, 20, 16].map((s) => (
            <figure key={s}><Mark size={s} /><figcaption>{s} px{s < 24 ? " · no 2" : ""}</figcaption></figure>
          ))}
        </div>
      </Section>

      <Section id="colour" title="Colour" lede="Purple and white carry the brand. Ink carries the text. Signal is reserved for the moment something is approved or sealed, and stays under 5% of any page.">
        <div className="swatches">
          {SWATCHES.map((s) => (
            <div className="swatch" key={s.name}>
              <div className="swatch__c" style={{ background: `var(${s.v})` }} />
              <div className="swatch__m"><b>{s.name}</b><span>{s.hex}</span><span style={{ fontFamily: "var(--font-body)" }}>{s.use}</span></div>
            </div>
          ))}
        </div>
        <p style={{ marginTop: "var(--space-6)", fontSize: "var(--text-sm)", color: "var(--q-ink-3)" }}>
          On dark surfaces the mark uses #C9BDFF and interface purple shifts to #AE9CFF to keep AA contrast. The full token list is in REBRAND_NOTES.md.
        </p>
      </Section>

      <Section id="type" title="Typography" lede="A grotesk for headings, a readable sans for text, a mono for record IDs and hashes.">
        <div className="type-specimen">
          <div><span className="mono">Schibsted Grotesk 600 · headings</span><span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "var(--text-2xl)", letterSpacing: "-0.02em" }}>Agents move assets. Prove every decision.</span></div>
          <div><span className="mono">IBM Plex Sans 400 · body</span><span style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-lg)", color: "var(--q-ink-2)" }}>Q² records who decided what, under which mandate, against which policy version.</span></div>
          <div><span className="mono">IBM Plex Mono 400 · data</span><span className="mono" style={{ fontSize: "var(--text-md)" }}>rec_7Q2KF9M4ZP · ML-DSA-65 · sha3-256 9c4e1a07</span></div>
        </div>
      </Section>

      <Section id="usage" title="Use and misuse">
        <div className="dodont">
          <div><h3 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-3)" }}>Do</h3><ul><li>Use the supplied SVG files.</li><li>Use purple on Paper, light purple on Ink.</li><li>Keep the clear space.</li><li>Write the name as Q Squared, or Q² once it has been introduced.</li></ul></div>
          <div><h3 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-3)" }}>Do not</h3><ul><li>Add gradients, glows or shadows to the mark.</li><li>Rotate, stretch or outline it.</li><li>Use Signal for the mark.</li><li>Place the mark inside a figure, or redraw it as one.</li><li>Add padlocks, circuits or chain cubes.</li></ul></div>
        </div>
      </Section>

      <Section id="figures" title="Figures" lede="Imagery is mathematics, drawn by hand in SVG: the formula behind each claim, in hairline strokes, purple for the working, amber for the one value that matters. Figures draw themselves in when they enter the screen. They illustrate ideas and are never part of the mark.">
        <div className="fig-grid">
          {FIGS.map(({ C, name, note }) => (
            <figure key={name} className="fig-tile is-in">
              <C />
              <figcaption><b>{name}</b><span>{note}</span></figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section id="explorations" title="Explorations" lede="Three directions were drawn. Direction A was chosen.">
        <div className="explore">
          {EXPLORATIONS.map((x) => (
            <figure key={x.file} className={x.picked ? "is-picked" : ""}>
              <div className="art"><img src={`/brand/explorations/${x.file}`} alt={x.name} width="140" height="140" /></div>
              <figcaption><b>{x.name}{x.picked ? " · chosen" : ""}</b><span>{x.note}</span></figcaption>
            </figure>
          ))}
        </div>
        <p style={{ marginTop: "var(--space-8)", maxWidth: "var(--measure)", color: "var(--q-ink-2)" }}>
          Direction A is the only one that says what Q² does without borrowing another icon's meaning. The ring is the Q.
          The line along its base is the line a decision is signed on, and the solid disc that closes it is the seal.
          It holds at 16 px as three shapes, it works in one colour, and the mark itself avoids the crypto and quantum
          clichés: no padlocks, circuits, chain cubes or atoms. The atom appears only as a scientific diagram on the site, never in the mark. B was rejected because at small sizes it reads as a speech bubble,
          and C because it reads as a magnifying glass, which is the wrong message for a product about proof.
        </p>
      </Section>
    </main>
  );
}
