import { useId } from "react";

// Mathematical figures, hand-written SVG. Each one draws a formula the product
// actually rests on. Lines carry pathLength="1" so CSS can draw them in when the
// figure enters view (see .fig in site.css); without motion they are simply drawn.
// Colours come from tokens via currentColor and CSS classes, never inline values.

const Fig = ({ className = "", label, viewBox, children }) => (
  <svg className={`fig ${className}`} viewBox={viewBox} role="img" aria-label={label} focusable="false">
    {children}
  </svg>
);

// Shamir-style threshold sharing: f(x) = s + a1 x + a2 x^2; shares are points on f; f(0) = s is the key.
const f = (x) => 1.6 + 0.9 * x - 0.18 * x * x;
const sx = (x) => 54 + x * 62;          // x in [0, 4.6]
const sy = (y) => 232 - y * 62;         // y in [0, 3.2]
const curve = Array.from({ length: 47 }, (_, i) => {
  const x = i * 0.1;
  return `${i ? "L" : "M"}${sx(x).toFixed(1)} ${sy(f(x)).toFixed(1)}`;
}).join(" ");

export function FigShares({ className = "" }) {
  return (
    <Fig className={className} viewBox="0 0 360 280" label="A polynomial curve through three key shares. Where it meets the vertical axis, f of zero equals s, the key.">
      <text className="fig__eq" x="352" y="22" textAnchor="end">f(x) = s + a₁x + a₂x²</text>
      <path className="fig__axis draw" pathLength="1" d="M54 244 V30 M42 232 H346" />
      {[1, 2, 3, 4].map((x) => <path key={x} className="fig__tick" d={`M${sx(x)} 232 v5`} />)}
      <path className="fig__line draw" pathLength="1" d={curve} />
      <path className="fig__guide draw" pathLength="1" d={`M54 ${sy(f(0))} H${sx(0.9)}`} />
      {[1.5, 2.5, 3.5].map((x, i) => (
        <g key={x} className="fig__pt" style={{ "--d": `${0.5 + i * 0.15}s` }}>
          <path className="fig__guide" d={`M${sx(x)} 232 V${sy(f(x))}`} />
          <circle className="fig__dot" cx={sx(x)} cy={sy(f(x))} r="5" />
          <text className="fig__lbl" x={sx(x)} y="252" textAnchor="middle">x{"₁₂₃"[i]}</text>
        </g>
      ))}
      <g className="fig__pt" style={{ "--d": "1s" }}>
        <circle className="fig__key" cx="54" cy={sy(f(0))} r="6.5" />
        <text className="fig__lbl fig__lbl--key" x="66" y={sy(f(0)) + 22}>f(0) = s</text>
      </g>
    </Fig>
  );
}

// Module lattice behind FIPS 204 signatures: public key t = A s1 + s2 (mod q). Basis b1, b2; a target t; small error s2.
const O = [150, 150], B1 = [44, 12], B2 = [16, 40];
const lat = [];
for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) {
  const x = O[0] + i * B1[0] + j * B2[0], y = O[1] + i * B1[1] + j * B2[1];
  if (x > 14 && x < 346 && y > 40 && y < 268) lat.push([x, y]);
}
const T = [O[0] + 2 * B1[0] + 1 * B2[0] + 9, O[1] + 2 * B1[1] + 1 * B2[1] - 7];
const L = [O[0] + 2 * B1[0] + 1 * B2[0], O[1] + 2 * B1[1] + 1 * B2[1]];

export function FigLattice({ className = "" }) {
  const aid = `arr-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <Fig className={className} viewBox="0 0 360 280" label="A two-dimensional lattice with basis vectors b1 and b2, a lattice point, and a target point a small error away from it.">
      <text className="fig__eq" x="352" y="22" textAnchor="end">t = A·s₁ + s₂  (mod q)</text>
      {lat.map(([x, y], k) => <circle key={k} className="fig__lat" cx={x} cy={y} r="1.8" />)}
      <path className="fig__vec draw" pathLength="1" d={`M${O[0]} ${O[1]} l${B1[0]} ${B1[1]}`} markerEnd={`url(#${aid})`} />
      <path className="fig__vec draw" pathLength="1" d={`M${O[0]} ${O[1]} l${B2[0]} ${B2[1]}`} markerEnd={`url(#${aid})`} />
      <text className="fig__lbl" x={O[0] + B1[0] + 4} y={O[1] + B1[1] - 6}>b₁</text>
      <text className="fig__lbl" x={O[0] + B2[0] - 18} y={O[1] + B2[1] + 6}>b₂</text>
      <circle className="fig__dot" cx={O[0]} cy={O[1]} r="3.5" />
      <g className="fig__pt" style={{ "--d": "0.8s" }}>
        <circle className="fig__ring" cx={L[0]} cy={L[1]} r="7" />
        <path className="fig__guide" d={`M${L[0]} ${L[1]} L${T[0]} ${T[1]}`} />
        <circle className="fig__key" cx={T[0]} cy={T[1]} r="5" />
        <text className="fig__lbl fig__lbl--key" x={T[0] + 9} y={T[1] - 6}>t</text>
        <text className="fig__lbl" x={L[0] - 4} y={L[1] + 22} textAnchor="middle">A·s₁</text>
      </g>
      <defs>
        <marker id={aid} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L8 4 L0 8 z" className="fig__head" />
        </marker>
      </defs>
    </Fig>
  );
}

// Hash chain: each record commits to the one before it. h_i = H(h_{i-1} || r_i).
export function FigChain({ className = "" }) {
  const aid = `arr-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const xs = [14, 100, 186, 272];
  return (
    <Fig className={className} viewBox="0 0 360 170" label="Four records in a row, each linked to the previous one by a hash.">
      <text className="fig__eq" x="352" y="22" textAnchor="end">hᵢ = H(hᵢ₋₁ ‖ rᵢ)</text>
      {xs.map((x, i) => (
        <g key={x} className="fig__pt" style={{ "--d": `${0.2 + i * 0.18}s` }}>
          <rect className={i === 3 ? "fig__box fig__box--on" : "fig__box"} x={x} y="58" width="74" height="62" rx="8" />
          <text className="fig__lbl" x={x + 37} y="84" textAnchor="middle">r{"₁₂₃₄"[i]}</text>
          <text className="fig__lbl fig__lbl--dim" x={x + 37} y="104" textAnchor="middle">h{"₁₂₃₄"[i]}</text>
        </g>
      ))}
      {xs.slice(0, 3).map((x, i) => (
        <path key={x} className="fig__line draw" pathLength="1" d={`M${x + 74} 89 H${xs[i + 1]}`} markerEnd={`url(#${aid})`} />
      ))}
      <text className="fig__lbl fig__lbl--dim" x="14" y="148">tamper with any rᵢ and every later h changes</text>
      <defs>
        <marker id={aid} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L8 4 L0 8 z" className="fig__head" />
        </marker>
      </defs>
    </Fig>
  );
}

// Quorum: approve iff at least k of n valid approvals; the agent can only propose.
export function FigQuorum({ className = "" }) {
  const aid = `arr-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const N = [[180, 64], [96, 210], [264, 210]];
  const C = [180, 160];
  return (
    <Fig className={className} viewBox="0 0 360 300" label="Three approvers around a decision. Two have approved, which meets the threshold of two of three. An agent sits outside and can only propose.">
      <text className="fig__eq" x="352" y="22" textAnchor="end">approve ⇔ Σ vᵢ ≥ k</text>
      {N.map(([x, y], i) => (
        <path key={i} className={`draw ${i < 2 ? "fig__line" : "fig__guide"}`} pathLength="1" d={`M${x} ${y} L${C[0]} ${C[1]}`} />
      ))}
      {N.map(([x, y], i) => (
        <g key={`n${i}`} className="fig__pt" style={{ "--d": `${0.3 + i * 0.15}s` }}>
          <circle className={i < 2 ? "fig__node fig__node--on" : "fig__node"} cx={x} cy={y} r="17" />
          <text className="fig__lbl" x={x} y={y + 5} textAnchor="middle">v{"₁₂₃"[i]}</text>
        </g>
      ))}
      <g className="fig__pt" style={{ "--d": "0.9s" }}>
        <circle className="fig__key" cx={C[0]} cy={C[1]} r="8" />
        <text className="fig__lbl fig__lbl--key" x={C[0] + 16} y={C[1] + 5}>2 ≥ k</text>
      </g>
      <g className="fig__pt" style={{ "--d": "1.1s" }}>
        <rect className="fig__box" x="14" y="44" width="70" height="30" rx="15" />
        <text className="fig__lbl" x="49" y="64" textAnchor="middle">agent</text>
        <path className="fig__guide" d="M84 59 C120 59 140 100 168 150" markerEnd={`url(#${aid})`} />
      </g>
      <text className="fig__lbl fig__lbl--dim" x="180" y="288" textAnchor="middle">k = 2, n = 3 · the agent proposes, it never votes</text>
      <defs>
        <marker id={aid} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L8 4 L0 8 z" className="fig__head" />
        </marker>
      </defs>
    </Fig>
  );
}


// Selective disclosure: a zero-knowledge proof that a statement holds over the
// records (every movement in the quarter had at least two approvals) while the
// amounts and counterparties stay hidden.
export function FigDisclose({ className = "" }) {
  const aid = `arr-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const rows = [["m₁", "2"], ["m₂", "3"], ["m₃", "2"], ["m₄", "2"]];
  return (
    <Fig className={className} viewBox="0 0 360 280" label="Four records with amounts and counterparties hidden. A proof shows only that each one had at least two approvals.">
      <text className="fig__eq" x="352" y="22" textAnchor="end">π ⊢ ∀m ∈ Q₃: approvals(m) ≥ 2</text>
      <text className="fig__lbl fig__lbl--dim" x="44" y="54">amount</text>
      <text className="fig__lbl fig__lbl--dim" x="112" y="54">counterparty</text>
      <text className="fig__lbl fig__lbl--dim" x="200" y="54">approvals</text>
      {rows.map(([m, a], i) => {
        const y = 66 + i * 40;
        return (
          <g key={m} className="fig__pt" style={{ "--d": `${0.2 + i * 0.12}s` }}>
            <rect className="fig__box" x="10" y={y} width="230" height="30" rx="7" />
            <text className="fig__lbl" x="22" y={y + 20}>{m}</text>
            <rect className="fig__mask" x="44" y={y + 10} width="56" height="10" rx="3" />
            <rect className="fig__mask" x="112" y={y + 10} width="74" height="10" rx="3" />
            <text className="fig__lbl fig__lbl--acc" x="212" y={y + 20} textAnchor="middle">{a}</text>
          </g>
        );
      })}
      <path className="fig__line draw" pathLength="1" d="M240 81 C270 81 270 140 292 140 M240 201 C270 201 270 140 292 140" />
      <g className="fig__pt" style={{ "--d": "0.9s" }}>
        <circle className="fig__node fig__node--on" cx="312" cy="140" r="20" />
        <text className="fig__lbl" x="312" y="145" textAnchor="middle">π</text>
        <path className="fig__guide" d="M312 162 V196" markerEnd={`url(#${aid})`} />
        <text className="fig__lbl fig__lbl--key" x="312" y="216" textAnchor="middle">true</text>
      </g>
      <text className="fig__lbl fig__lbl--dim" x="10" y="266">the reader learns the statement, not the positions</text>
      <defs>
        <marker id={aid} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L8 4 L0 8 z" className="fig__head" />
        </marker>
      </defs>
    </Fig>
  );
}

export const FIGURES = { quorum: FigQuorum, record: FigChain, seal: FigLattice, custody: FigShares, disclose: FigDisclose };
