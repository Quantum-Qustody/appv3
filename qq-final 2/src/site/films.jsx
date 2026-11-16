// The ten demo films, scene by scene, from the Q² Demo Storyboard v2.0
// (13 Nov 2026). Every scene is a pure function of its local time `lt`
// (seconds since the scene began), so the player can seek anywhere and every
// take is identical. Screens use the one worked example from filmsList.js.
//
// Scene shape:
//   { d, kind: "cold" | "screen" | "end", cap, S: Component,
//     zoom: [{ at, in, hold, out, s, x, y }],     push in, hold, pull back
//     thread: { show, line, beads, beadAt, beadGap, breakAt, mend, sealAt,
//               darkAt, darkFrom, strayAt } }
import { EXAMPLE as X } from "./filmsList.js";

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);

// Reduced motion: the player sets this; appear() then only fades.
let REDUCED = false;
export const setReducedMotion = (v) => { REDUCED = !!v; };

/** Fade and lift an element in at local time `at`. */
const ap = (lt, at = 0, d = 0.45, dy = 14) => {
  const p = ease((lt - at) / d);
  return REDUCED ? { opacity: p } : { opacity: p, transform: `translateY(${((1 - p) * dy).toFixed(2)}px)` };
};
const on = (lt, at) => lt >= at;
const typed = (lt, at, text, cps = 30) => text.slice(0, Math.max(0, Math.floor((lt - at) * cps)));
const pad2 = (n) => String(n).padStart(2, "0");

/* ── Small building blocks ─────────────────────────────────────────── */

const NAV = ["Movements", "Approvals", "Rules", "Alerts", "Evidence"];

function Win({ title, tab, children, w = 1060, style }) {
  return (
    <div className={`fw${w < 700 ? " fw--narrow" : ""}`} style={{ width: w, ...style }}>
      <div className="fw__bar">
        <span className="fw__title"><b>Q²</b> · {title}</span>
        {tab && w >= 700 && <span className="fw__nav">{NAV.map((n) => <i key={n} className={n === tab ? "is-on" : ""}>{n}</i>)}</span>}
      </div>
      <div className="fw__body">{children}</div>
    </div>
  );
}

// Status in words and shape, never colour alone.
const TAGS = {
  pass: ["✓", "Pass", "ok"],
  fail: ["✕", "Fail", "no"],
  wait: ["◷", "Waiting", "wait"],
  skip: ["–", "Not run", "skip"],
};
function Tag({ k, label }) {
  const [ic, word, cls] = TAGS[k];
  return <span className={`ftag ftag--${cls}`}><span aria-hidden="true">{ic}</span> {label || word}</span>;
}
function Line({ k, children, style, label }) {
  return <div className="sl" style={style}><Tag k={k} label={label} /><span>{children}</span></div>;
}
function KV({ k, children, style, mono }) {
  return <div className="kv" style={style}><span className="kv__k">{k}</span><span className={`kv__v${mono ? " mono" : ""}`}>{children}</span></div>;
}
const Addr = ({ children, style }) => <span className="addr" style={style}>{children}</span>;

function Banner({ tone = "no", children, style }) {
  const ic = tone === "no" ? "✕" : tone === "ok" ? "✓" : tone === "flag" ? "⚑" : "•";
  return <div className={`bn bn--${tone}`} style={style}><span aria-hidden="true" className="bn__ic">{ic}</span><span>{children}</span></div>;
}

function Seal({ children, style }) {
  return <div className="fseal" style={style}><i aria-hidden="true" />{children}</div>;
}

function Phone({ children, style, label }) {
  return (
    <div className="fp" style={style}>
      {label && <div className="fp__who">{label}</div>}
      <div className="fp__scr">{children}</div>
    </div>
  );
}

function Pin({ n, lit }) {
  return <span className={`pin${lit ? " is-lit" : ""}`}>{n}</span>;
}

function Cursor({ x, y, style }) {
  return (
    <svg className="cur" style={{ left: x, top: y, ...style }} width="26" height="30" viewBox="0 0 26 30" aria-hidden="true">
      <path d="M2 2 L2 24 L8 18.5 L12.5 28 L16.5 26.2 L12 17 L20 17 Z" fill="#F4F2FB" stroke="#08061A" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Shared screens ────────────────────────────────────────────────── */

function NewMovement({ lt, w = 1060, to = `${X.borrower} registered 14 Mar`, toMono = false, proposer = `${X.proposer} · analyst`, action = `Send ${X.amount}`, purpose = "Loan drawdown · deal ticket DT-118", fill = true, submitAt = 7.5 }) {
  const rows = [["Proposed by", proposer], ["Action", action], ["From", X.wallet], ["To", to], ["Purpose", purpose]];
  return (
    <Win title="New movement" tab="Movements" w={w}>
      <div className="mvform">
        {rows.map(([k, v], i) => {
          const at = fill ? 0.6 + i * 1.15 : 0;
          const shown = fill ? typed(lt, at, v, 34) : v;
          const isTo = k === "To" && toMono;
          return (
            <div key={k} className={`fi${lt >= at && lt < at + v.length / 34 + 0.25 ? " is-typing" : ""}`}>
              <span className="fi__k">{k}</span>
              <span className={`fi__v${isTo ? " addr" : ""}`}>{shown}<b className="caret" aria-hidden="true" /></span>
            </div>
          );
        })}
      </div>
      <div className="fw__actions" style={ap(lt, submitAt - 1.4)}>
        <span className="fb">Cancel</span>
        <span className={`fb fb--go${on(lt, submitAt) ? " is-pressed" : ""}`}>Submit for check</span>
      </div>
    </Win>
  );
}

function RecordStrip({ lt, at = 0, done = 7, fail }) {
  const steps = ["Request", "Check", "Approve", "Sign", "Settle", "Book", "Prove"];
  return (
    <ol className="strip">
      {steps.map((s, i) => {
        const isDone = i < done && on(lt, at + i * 0.18);
        const isFail = fail === i;
        return (
          <li key={s} className={isFail ? "is-fail" : isDone ? "is-done" : ""}>
            <i aria-hidden="true">{isFail ? "✕" : isDone ? "✓" : ""}</i>
            <span>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

/* ═════════════════ Film 01 · One movement, one record ═════════════════ */

function F01Check({ lt }) {
  const rows = [
    ["pass", "Destination is a registered counterparty"],
    ["pass", "Borrower limit: 3.1% of NAV, limit 4%"],
    ["pass", "NAV from the administrator, 31 Oct"],
    ["wait", "Approvals: 0 of 2 · proposer excluded"],
  ];
  return (
    <Win title="Check result" tab="Movements">
      <div className="rid" style={ap(lt, 0.4)}>
        <span className="rid__k">Record created</span>
        <span className="rid__v mono">{X.record}</span>
      </div>
      <div className="lines">
        {rows.map(([k, t], i) => <Line key={t} k={k} style={ap(lt, 4.6 + i * 1.2)}>{t}</Line>)}
      </div>
    </Win>
  );
}

function ApprovePhone({ lt, who, time, at }) {
  const done = on(lt, at);
  return (
    <Phone label={`${who} · own device`}>
      <div className="fp__bar"><span>Q² Approve</span><span className="mono">{X.record}</span></div>
      <div className="fp__act">Send {X.amount}</div>
      <div className="fp__row"><b>To</b><span>{X.borrower}</span></div>
      <div className="fp__row"><b>Rule</b><span>{X.rule}</span></div>
      <div className="fp__bt">
        <span className="fb">Refuse</span>
        <span className={`fb fb--go${done ? " is-pressed" : ""}`}>{done ? "✓ Approved" : "Approve"}</span>
      </div>
      <div className="fp__fine" style={{ opacity: done ? 1 : 0 }}>Approved {time} · on the record</div>
    </Phone>
  );
}

function F01Approve({ lt }) {
  return (
    <div className="duo">
      <div style={ap(lt, 0.2)}><ApprovePhone lt={lt} who={X.approvers[0]} time="10:14" at={3.2} /></div>
      <div style={ap(lt, 0.6)}><ApprovePhone lt={lt} who={X.approvers[1]} time="10:21" at={6.8} /></div>
    </div>
  );
}

function F01Cuts({ lt }) {
  const cards = [
    ["Signer", "Signed", "Matches what was approved", 0.6],
    ["Chain", "Settled", `${X.amount} to ${X.borrower}`, 4.6],
    ["Administrator", "Booked", `Ledger entry ${X.ledger}`, 8.6],
  ];
  return (
    <div className="trio">
      {cards.map(([who, what, val, at]) => (
        <div key={who} className={`fcard${on(lt, at + 0.5) ? " is-on" : ""}`} style={ap(lt, at)}>
          <span className="fcard__who">{who}</span>
          <b className="fcard__what"><span aria-hidden="true">✓</span> {what}</b>
          <span className="fcard__val">{val}</span>
          <span className="fcard__note">Unchanged: its own system, its own policies</span>
        </div>
      ))}
    </div>
  );
}

function FullRecord({ lt, sealAt = 2.2 }) {
  return (
    <Win title={X.record} tab="Evidence">
      <RecordStrip lt={lt} at={0.2} />
      <div className="kvs kvs--2">
        <KV k="Approved by">{X.approvers[0]} 10:14 · {X.approvers[1]} 10:21</KV>
        <KV k="Signed">Matches what was approved</KV>
        <KV k="Settled">{X.amount} to {X.borrower}</KV>
        <KV k="Booked">Ledger entry {X.ledger}</KV>
      </div>
      <Seal style={ap(lt, sealAt, 0.6)}>Sealed · 7 of 7 facts · ready for your auditor</Seal>
    </Win>
  );
}

/* ═════════════════ Film 02 · Refused, with a reason ═════════════════ */

const BAD_ADDR = "0x9c4e 1a07 b2f5 8d3e 6a1c 0b94 f7d2 e8a5 3c11 90be";

function F02Try({ lt }) {
  return <NewMovement lt={lt} to={BAD_ADDR} toMono action="Send 250,000 USDC" purpose="Payment" submitAt={6.6} />;
}

function F02Refused({ lt }) {
  return (
    <Win title="Check result" tab="Movements">
      <Banner tone="no" style={ap(lt, 0.5)}>Refused · nothing was sent to the signer</Banner>
      <div className="lines">
        <Line k="fail" style={ap(lt, 1.4)}>Destination is not in the counterparty register<Addr style={{ display: "block", marginTop: 6 }}>{BAD_ADDR}</Addr></Line>
        <Line k="skip" style={ap(lt, 2.2)}>Borrower limit</Line>
        <Line k="skip" style={ap(lt, 2.6)}>Approvals</Line>
      </div>
      <div className="kvs kvs--2" style={ap(lt, 4)}>
        <KV k="Reason" mono>DESTINATION_NOT_REGISTERED</KV>
        <KV k="Alert sent to">{X.approvers[0]} · {X.approvers[1]}</KV>
      </div>
    </Win>
  );
}

function F02Limit({ lt }) {
  // The meter fills to 4.5% across the 4% line.
  const v = 4.5 * ease((lt - 0.8) / 2.6);
  const over = v > 4;
  return (
    <Win title="Check result" tab="Movements">
      <Banner tone="no" style={{ ...ap(lt, 3.4), visibility: lt < 3.4 ? "hidden" : "visible" }}>Refused · past the single-borrower limit</Banner>
      <div className="meter">
        <div className="meter__k">{X.borrower} after this loan</div>
        <div className="meter__bar">
          <div className={`meter__fill${over ? " is-over" : ""}`} style={{ width: `${(v / 5) * 100}%` }} />
          <div className="meter__lim" style={{ left: "80%" }}><span>limit 4%</span></div>
        </div>
        <div className="meter__scale"><span>0%</span><b className="mono">{v.toFixed(1)}%</b></div>
      </div>
      <div className="kvs kvs--2" style={ap(lt, 4.4)}>
        <KV k="Reason" mono>LIMIT_BORROWER_EXCEEDED</KV>
        <KV k="NAV from">The administrator, never the request</KV>
      </div>
    </Win>
  );
}

function F02List({ lt }) {
  const rows = [
    ["MR-7F3B-0007", "900,000 USDC to Borrower X", "Limit exceeded"],
    ["MR-7F3B-0006", "250,000 USDC to an unknown address", "Not registered"],
    ["MR-7F3B-0004", "Sweep before acceptance", "Not accepted"],
  ];
  return (
    <Win title="Refusals" tab="Alerts">
      <table className="tb">
        <thead><tr><th>Record</th><th>Attempt</th><th>Reason</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r[0]} style={ap(lt, 0.6 + i * 0.9)}>
              <td className="mono">{r[0]}</td><td>{r[1]}</td><td><Tag k="fail" label={r[2]} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ffoot" style={ap(lt, 4)}>3 refusals today · each sealed with its reason</div>
    </Win>
  );
}

/* ═════════════════ Film 03 · The proposer cannot approve ═════════════════ */

function ApprovalRows({ lt, okoro, lindqvist, showBan, cursor, w = 1060 }) {
  const rows = [
    [X.proposer, "Proposer · excluded", "excl"],
    [X.approvers[0], okoro, okoro.startsWith("✓") ? "ok" : "wait"],
    [X.approvers[1], lindqvist, lindqvist.startsWith("✓") ? "ok" : "wait"],
  ];
  return (
    <Win title={`Approvals · ${X.record}`} tab="Approvals" w={w}>
      {showBan !== undefined && <Banner tone="no" style={{ ...ap(lt, showBan), visibility: lt < showBan ? "hidden" : "visible" }}>{X.proposer} proposed this and cannot approve it</Banner>}
      <div className="people">
        {rows.map(([n, s, k]) => (
          <div key={n} className={`fperson fperson--${k}${k === "excl" && showBan !== undefined && on(lt, showBan) ? " is-grey" : ""}`}>
            <span className="fperson__av" aria-hidden="true">{n.split(" ").map((p) => p[0]).join("").replace(".", "")}</span>
            <b>{n}</b>
            <span className="fperson__s">{k === "excl" ? <><span aria-hidden="true">⊘</span> {s}</> : k === "ok" ? s : <><span aria-hidden="true">◷</span> {s}</>}</span>
          </div>
        ))}
      </div>
      {cursor}
    </Win>
  );
}

function F03Try({ lt }) {
  // Her cursor travels to where an Approve button would be. It is not there.
  const p = ease((lt - 0.8) / 2);
  const x = 330 + p * 560, y = 420 - p * 200;
  return (
    <div style={{ position: "relative" }}>
      <ApprovalRows lt={lt} okoro="Waiting" lindqvist="Waiting" showBan={3.2}
        cursor={<Cursor x={x} y={y} />} />
    </div>
  );
}

function F03One({ lt }) {
  const done = on(lt, 1.2);
  return (
    <div className="duo duo--wide">
      <div style={ap(lt, 0)}><ApprovePhone lt={lt} who={X.approvers[0]} time="10:14" at={1.2} /></div>
      <div style={{ ...ap(lt, 2.4), width: 600 }}>
        <ApprovalRows lt={lt} w={600} okoro={done ? "✓ Approved 10:14 · own device" : "Waiting"} lindqvist="Waiting" />
        <div className="count count--wait" style={ap(lt, 3.4)}><span aria-hidden="true">◷</span> 1 of 2 · not enough to sign</div>
      </div>
    </div>
  );
}

function F03Two({ lt }) {
  const done = on(lt, 1.6);
  return (
    <div className="duo duo--wide">
      <div style={ap(lt, 0)}><ApprovePhone lt={lt} who={X.approvers[1]} time="10:21" at={1.6} /></div>
      <div style={{ ...ap(lt, 0.4), width: 600 }}>
        <ApprovalRows lt={lt} w={600} okoro="✓ Approved 10:14" lindqvist={done ? "✓ Approved 10:21" : "Waiting"} />
        <div className={`count${done ? " count--ok" : " count--wait"}`} style={ap(lt, 2.2)}>{done ? <><span aria-hidden="true">✓</span> 2 of 2 · released to the signer</> : "1 of 2"}</div>
      </div>
    </div>
  );
}

/* ═════════════════ Film 04 · What the approver sees ═════════════════ */

function ApproveScreen({ lt, pins = [0, 0, 0, 0, 0], pressedAt }) {
  const pressed = pressedAt !== undefined && on(lt, pressedAt);
  const lit = (i) => pins[i] !== undefined && on(lt, pins[i]);
  return (
    <Phone>
      <div className="fp__bar"><span>Q² Approve</span><span className="mono">{X.record}</span></div>
      <div className="fp__act">Send {X.amount}</div>
      <div className="fp__row"><Pin n={1} lit={lit(0)} /><b>Effect</b><span>Transfer. Control of the wallet does not change</span></div>
      <div className="fp__row" data-z="addr"><Pin n={2} lit={lit(1)} /><b>To</b><span>{X.borrower} · registered 14 Mar · paid 6 times<Addr style={{ display: "block", marginTop: 4 }}>{X.address}</Addr></span></div>
      <div className="fp__row"><Pin n={3} lit={lit(2)} /><b>Asked by</b><span>{X.proposer} · signed on her own key</span></div>
      <div className="fp__row"><Pin n={4} lit={lit(3)} /><b>Allowed by</b><span>{X.rule}</span></div>
      <div className="fp__row"><Pin n={5} lit={lit(4)} /><b>Expires</b><span>In 28 minutes · approval 1 of 2</span></div>
      <div className="fp__bt">
        <span className="fb">Refuse</span>
        <span className={`fb fb--go${pressed ? " is-pressed" : ""}`}>{pressed ? "✓ Approved" : "Approve"}</span>
      </div>
      <div className="fp__fine">Approve only here. Q² never sends approval links</div>
    </Phone>
  );
}

const PINS = [1.5, 4, 6.5, 9, 11.5];
const NOTES = [
  ["The real effect", "Decoded from the transaction, twice"],
  ["The destination's history", "Full address, age, payment history"],
  ["Who asked, with proof", "A person's own key"],
  ["The rule that allows it", "And the source of each number"],
  ["A short expiry", "Approvals cannot be stockpiled"],
];
const Fit = ({ children, s = 0.84 }) => <div style={{ transform: `scale(${s})` }}>{children}</div>;
function F04Pins({ lt }) {
  return (
    <div className="duo duo--wide" style={{ marginTop: -60 }}>
      <div style={ap(lt, 0.2)}><Fit s={0.8}><ApproveScreen lt={lt} pins={PINS} /></Fit></div>
      <ol className="notes">
        {NOTES.map(([h, d], i) => (
          <li key={h} className={on(lt, PINS[i]) ? "is-lit" : ""} style={ap(lt, PINS[i] - 0.2)}>
            <Pin n={i + 1} lit={on(lt, PINS[i])} /><div><b>{h}</b><span>{d}</span></div>
          </li>
        ))}
      </ol>
    </div>
  );
}
const F04Hold = ({ lt }) => <Fit s={0.78}><ApproveScreen lt={lt} /></Fit>;
function F04Press({ lt }) {
  return (
    <div style={{ position: "relative" }}>
      <Fit s={0.78}><ApproveScreen lt={lt} pressedAt={1.4} /></Fit>
      <div className="thumb" style={{ opacity: lt > 0.4 && lt < 2.4 ? 1 : 0 }} aria-hidden="true" />
    </div>
  );
}

function ControlScreen({ lt, dissolveAt = 0, warnAt = 0 }) {
  const gone = on(lt, dissolveAt);
  const dissolve = ease((lt - dissolveAt) / 0.9);
  return (
    <Phone>
      <div className="fp__bar"><span>Q² Approve</span><span className="mono">MR-7F3C-0002</span></div>
      <div className="fp__act">{gone ? "Change of control" : "Routine transfer"}</div>
      <div className="fp__row"><Pin n={1} lit /><b>Effect</b><span>Makes another contract a controller of {X.wallet}</span></div>
      <div className="fp__row"><Pin n={3} lit /><b>Asked as</b><span>“Routine transfer”</span></div>
      <div data-z="warn" style={{ display: "grid", gap: 8 }}>
        <div className="fp__note fp__note--warn" style={{ ...ap(lt, warnAt), visibility: lt < warnAt ? "hidden" : "visible" }}><span aria-hidden="true">✕</span> The description does not match the decoded effect</div>
        <div className="fp__note fp__note--warn" style={{ ...ap(lt, warnAt + 0.6), visibility: lt < warnAt + 0.6 ? "hidden" : "visible" }}>Needs 3 of 4 approvers and a 72-hour delay</div>
      </div>
      <div className="fp__bt">
        <span className="fb">Refuse</span>
        {!gone || dissolve < 1
          ? <span className="fb fb--go" style={{ opacity: 1 - dissolve, filter: `blur(${dissolve * 6}px)` }}>Approve</span>
          : <span className="fb fb--esc">Escalate</span>}
      </div>
      <div className="fp__fine">{gone ? "No Approve button on this screen" : "Approve only here. Q² never sends approval links"}</div>
    </Phone>
  );
}

function F04Second({ lt }) {
  const x = REDUCED ? 0 : (1 - ease(lt / 0.9)) * 420;
  return <div style={{ transform: `translateX(${x}px)`, opacity: ease(lt / 0.5) }}><Fit s={0.92}><ControlScreen lt={lt} dissolveAt={5} warnAt={6.2} /></Fit></div>;
}
const F04Warn = ({ lt }) => <Fit s={0.92}><ControlScreen lt={lt + 20} dissolveAt={0} warnAt={0} /></Fit>;

/* ═════════════════ Film 05 · A system's word is not an approval ═════════════════ */

function F05Arrive({ lt }) {
  return (
    <Win title="Incoming request" tab="Movements" w={900}>
      <div className="req">
        <span className="req__av" style={ap(lt, 0.4)} aria-label="No person attached" />
        <div className="kvs" style={{ flex: 1 }}>
          <KV k="Asked by" style={ap(lt, 1.2)}><span className="mono">payments-service</span> · a system, not a person</KV>
          <KV k="It claims" style={ap(lt, 2.4)}>“Approved by {X.approvers[0]}”</KV>
          <KV k="From" style={ap(lt, 3.4)}>{X.wallet}</KV>
        </div>
      </div>
    </Win>
  );
}

function F05Refused({ lt }) {
  return (
    <Win title="Check result" tab="Movements">
      <Banner tone="no" style={ap(lt, 0.3)}>Refused · no person's proof behind this request</Banner>
      <div className="kvs">
        <KV k="Asked by" style={ap(lt, 0.8)}><span data-z="sys"><span className="mono">payments-service</span> · a system, not a person</span></KV>
        <KV k="It claims" style={ap(lt, 1.3)}>“Approved by {X.approvers[0]}”</KV>
        <KV k="Proof" style={ap(lt, 1.8)}><span data-z="proof">None. No signature from {X.approvers[0]}'s own key</span></KV>
        <KV k="Grade" style={ap(lt, 2.3)}><span className="gb gb--0">0</span> unproven</KV>
        <KV k="Reason" mono style={ap(lt, 2.8)}>NO_PERSON_PROOF</KV>
      </div>
    </Win>
  );
}

const MONTH = [
  [X.record, "2,000,000 USDC loan", "1", "a person approved it"],
  ["MR-7F3A-0930", "Rebalance inside a mandate", "2", "signed mandate"],
  ["MR-7F3A-0934", "Sweep to an internal address", "3", "a system says so"],
  ["MR-7F3B-0011", "payments-service request", "0", "refused"],
];

function F05Month({ lt, compact }) {
  return (
    <Win title="Movements · October" tab="Movements">
      <table className="tb">
        <thead><tr><th>Record</th><th>Movement</th><th>Proof behind it</th></tr></thead>
        <tbody>
          {MONTH.map((r, i) => (
            <tr key={r[0]} style={compact ? undefined : ap(lt, 0.6 + i * 1.3)} className={`gr-row gr-row--${r[2]}`}>
              <td className="mono">{r[0]}</td><td>{r[1]}</td><td><span className={`gb gb--${r[2]}`}>{r[2]}</span> {r[3]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Win>
  );
}

function F05Bar({ lt }) {
  const g = (at) => ease((lt - at) / 0.9);
  return (
    <div style={{ display: "grid", gap: 26, width: 1060 }}>
      <div style={{ opacity: 1 - 0.5 * g(0.2) }}><F05Month lt={lt} compact /></div>
      <div className="gbar" aria-label="Share of October movements by grade">
        <div className="gbar__s gbar__s--1" style={{ width: `${58 * g(0.6)}%` }}><span>Grade 1 · 58%</span></div>
        <div className="gbar__s gbar__s--2" style={{ width: `${31 * g(1.4)}%` }}><span>Grade 2 · 31%</span></div>
        <div className="gbar__s gbar__s--3" style={{ width: `${11 * g(2.2)}%` }}><span>3</span></div>
      </div>
    </div>
  );
}

/* ═════════════════ Film 06 · Change the rule, then try to use it ═════════════════ */

function Clock({ secondsLeft }) {
  const s = Math.max(0, Math.round(secondsLeft));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const frac = s / (48 * 3600);
  const a = frac * 2 * Math.PI;
  return (
    <div className="clock">
      <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
        <circle cx="38" cy="38" r="33" fill="none" stroke="#372F5A" strokeWidth="3" />
        <path d={`M38 5 A33 33 0 ${frac > 0.5 ? 1 : 0} 1 ${38 + 33 * Math.sin(a)} ${38 - 33 * Math.cos(a)}`} fill="none" stroke="#AE9CFF" strokeWidth="3" />
        <line x1="38" y1="38" x2={38 + 22 * Math.sin(a)} y2={38 - 22 * Math.cos(a)} stroke="#F4F2FB" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <div><span className="clock__k">Usable in</span><b className="mono">{pad2(h)}:{pad2(m)}:{pad2(sec)}</b></div>
    </div>
  );
}

function F06Add({ lt }) {
  return (
    <Win title="Rules · new destination" tab="Rules" w={940}>
      <div className="mvform">
        <div className="fi"><span className="fi__k">Destination</span><span className="fi__v">{typed(lt, 0.5, "Borrower Y", 12)}<b className="caret" aria-hidden="true" /></span></div>
        <div className="fi" style={ap(lt, 1.8)}><span className="fi__k">Added by</span><span className="fi__v">{X.proposer} · 14:03</span></div>
      </div>
      <div style={{ ...ap(lt, 3), marginTop: 22 }}><Clock secondsLeft={48 * 3600 - Math.max(0, lt - 3.4)} /></div>
    </Win>
  );
}

function F06History({ lt }) {
  const rows = [
    ["New destination", "none", "“Borrower Y”", `${X.proposer} 14:03`, "in 47h 58m"],
    ["Borrower limit", "4% of NAV", "6% of NAV", `${X.approvers[0]} 09:40`, "needs a 2nd approver"],
    ["Signer policy", "v6", "v7", `${X.approvers[1]} 2 Nov`, "active"],
  ];
  const sweep = clamp((lt - 1.2) / 6) * 5;
  return (
    <Win title="Rules · change history" tab="Rules">
      <table className="tb tb--hist">
        <thead><tr><th>Change</th><th>Before</th><th>After</th><th>By</th><th>Usable</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r[0]} style={ap(lt, 0.3 + i * 0.4)}>
              {r.map((c, j) => <td key={j} className={i === 0 && j <= sweep && j >= sweep - 1 ? "is-sweep" : ""} data-z={i === 0 ? "row" : undefined}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ffoot" style={ap(lt, 7.6)}>2 changes waiting · approvers notified</div>
    </Win>
  );
}

function F06Propose({ lt }) {
  // Time-lapse: two minutes pass on the clock, then the same person proposes.
  const elapsed = 120 * ease(lt / 3.5);
  return (
    <div className="duo duo--wide" style={{ alignItems: "center" }}>
      <div style={{ width: 260 }}><Clock secondsLeft={48 * 3600 - elapsed} /></div>
      <div style={ap(lt, 3.6)}>
        <NewMovement w={780} lt={Math.max(0, lt - 3.6)} to="Borrower Y · added 2 minutes ago" action="Send USDC" purpose="Loan drawdown" submitAt={6.6} />
      </div>
    </div>
  );
}

function F06Refused({ lt }) {
  return (
    <Win title="Check result" tab="Movements">
      <Banner tone="no" style={ap(lt, 1.2)}>Refused · added 2 minutes ago, by the same person</Banner>
      <div className="lines">
        <Line k="fail" style={ap(lt, 1.8)}>New destinations wait 48 hours · 47h 58m left</Line>
        <Line k="fail" style={ap(lt, 2.4)}>Added by {X.proposer}, who is also the proposer</Line>
      </div>
      <div className="kvs kvs--2" style={ap(lt, 3.4)}>
        <KV k="Reason" mono>COOLING_OFF_ACTIVE</KV>
        <KV k="Flag">Changed, then used, by one person</KV>
      </div>
    </Win>
  );
}

/* ═════════════════ Film 07 · The payment that went around ═════════════════ */

function F07Arc({ lt }) {
  const nodes = ["Request", "Q² check", "Approve", "Signer", "Chain"];
  const xs = [90, 300, 510, 720, 930];
  const p = ease((lt - 1.4) / 2.6);
  // Arc from far left, over the workflow, down to the signer.
  const path = "M 20 250 C 220 40, 560 40, 720 196";
  return (
    <div className="flow">
      <svg width="1020" height="330" viewBox="0 0 1020 330" aria-hidden="true">
        <line x1="90" y1="230" x2="930" y2="230" stroke="#372F5A" strokeWidth="2" />
        <path d={path} fill="none" stroke="#FF8A80" strokeWidth="3" strokeDasharray="10 8" pathLength="1" style={{ strokeDasharray: "0.02 0.015", strokeDashoffset: 0, opacity: p > 0 ? 1 : 0, clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` }} />
      </svg>
      {nodes.map((n, i) => (
        <div key={n} className={`node${i === 3 ? " node--hit" : ""}${i === 1 || i === 2 ? " node--skip" : ""}`} style={{ left: xs[i], ...ap(lt, 0.2 + i * 0.15) }}>
          {n}
          {(i === 1 || i === 2) && on(lt, 4.2) && <em>skipped</em>}
        </div>
      ))}
      <div className="flow__lbl" style={ap(lt, 4.4)}>Started directly at the signer · no request, no check, no approval</div>
    </div>
  );
}

const ODD_ADDR = "0x3d55 08c1 77aa e2b4 19f0 6c3d a4e8 52b7 0d19 90be";

function F07Alert({ lt }) {
  return (
    <Win title="Alerts" tab="Alerts">
      <Banner tone="flag" style={ap(lt, 0.4)}>Unmatched movement · {X.wallet} · 310,000 USDC</Banner>
      <div className="kvs">
        <KV k="To" style={ap(lt, 1)}>Not registered<Addr style={{ display: "block", marginTop: 4 }}>{ODD_ADDR}</Addr></KV>
        <KV k="Record" style={ap(lt, 1.6)}><span data-z="none"><b className="none">None</b></span></KV>
        <KV k="Approvals" style={ap(lt, 2.1)}>None</KV>
        <KV k="Signer" style={ap(lt, 2.6)}>Signed under its own policy</KV>
      </div>
      <div className="fw__actions" style={ap(lt, 3.4)}><span className="fb fb--go">Notify approvers</span><span className="fb">Mark wallet</span></div>
    </Win>
  );
}

function F07Day({ lt }) {
  const rows = [
    ["10:24", "2,000,000 USDC to Borrower X", "ok", X.record],
    ["13:10", "40,000 USDC to the fee account", "ok", "MR-7F3A-0933"],
    ["15:07", "310,000 USDC to an unknown address", "flag", "Unmatched"],
  ];
  return (
    <Win title={`${X.wallet} · today`} tab="Movements">
      <table className="tb">
        <thead><tr><th>Time</th><th>Outflow</th><th>Record</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r[0]} style={ap(lt, 0.5 + i * 1)}>
              <td className="mono">{r[0]}</td><td>{r[1]}</td>
              <td>{r[2] === "ok" ? <Tag k="pass" label={r[3]} /> : <span className="ftag ftag--flag"><span aria-hidden="true">⚑</span> {r[3]}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="ffoot" style={ap(lt, 4.2)}>Wallet marked · approvers notified 15:07</div>
    </Win>
  );
}

/* ═════════════════ Film 08 · Evidence in minutes ═════════════════ */

function F08Desk({ lt }) {
  const items = [
    ["signer-export-oct.csv", -6, 120, 60, 0.5],
    ["ledger-oct.xlsx", 4, 520, 30, 1.4],
    ["“who approved the 2m loan?”", -3, 300, 240, 2.3, "chat"],
    ["screenshot-1014.png", 7, 640, 220, 3.1],
    ["screenshot-1021.png", -8, 80, 300, 3.8],
    ["“can you resend the signer log?”", 3, 560, 380, 4.6, "chat"],
    ["approvals-thread.pdf", -2, 260, 420, 5.4],
  ];
  const turns = lt * 1.6;
  return (
    <div className="desk">
      {items.map(([t, r, x, y, at, kind]) => (
        <div key={t} className={`desk__it${kind ? " desk__it--chat" : ""}`} style={{ left: x, top: y, transform: REDUCED ? undefined : `rotate(${r}deg) scale(${0.9 + 0.1 * ease((lt - at) / 0.4)})`, opacity: ease((lt - at) / 0.4) }}>{t}</div>
      ))}
      <svg className="desk__clock" width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="54" fill="#141029" stroke="#372F5A" strokeWidth="3" />
        <line x1="60" y1="60" x2={60 + 30 * Math.sin(turns / 12 * 2 * Math.PI)} y2={60 - 30 * Math.cos(turns / 12 * 2 * Math.PI)} stroke="#F4F2FB" strokeWidth="4" strokeLinecap="round" />
        <line x1="60" y1="60" x2={60 + 44 * Math.sin(turns * 2 * Math.PI)} y2={60 - 44 * Math.cos(turns * 2 * Math.PI)} stroke="#AE9CFF" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function F08Export({ lt }) {
  const pressed = on(lt, 3);
  const secs = pressed ? Math.min(41, Math.floor((lt - 3) * 4.2)) : 0;
  return (
    <Win title="Evidence · export" tab="Evidence">
      <div className="kvs">
        <KV k="Movement">{X.record} · {X.amount}</KV>
        <KV k="For">Auditor · sample 14 of 25</KV>
        <KV k="Contains">Request · check · approvals · signature · settlement · ledger · seal</KV>
        <KV k="Formats">PDF for people · data for testing</KV>
      </div>
      <div className="fw__actions">
        <span className="timer mono" data-z="timer">{secs >= 41 ? "Ready in 00:41" : `00:${pad2(secs)}`}</span>
        <span className={`fb fb--go${pressed ? " is-pressed" : ""}`}>Export evidence pack</span>
      </div>
      <Cursor x={ease((lt - 0.6) / 2) * 120 + 760} y={460 - ease((lt - 0.6) / 2) * 60} style={{ opacity: lt < 4 ? 1 : 0 }} />
    </Win>
  );
}

function F08Pack({ lt }) {
  const lines = [
    ["1 · Who asked", `${X.proposer}, analyst · 10:02`],
    ["2 · Which rule", "Mandate v12 · limit 4% · result 3.1%"],
    ["3 · Who approved", `${X.approvers[0]} 10:14 · ${X.approvers[1]} 10:21`],
    ["4 · What was signed", "Matches what was approved"],
    ["5 · What settled", `${X.amount} to ${X.borrower}`],
    ["6 · Where booked", `Ledger entry ${X.ledger}`],
  ];
  return (
    <Win title={`Evidence pack · ${X.record}`} tab="Evidence">
      <div className="kvs kvs--2">
        {lines.map(([k, v], i) => <KV key={k} k={k} style={ap(lt, 1 + i * 2.2)}>{v}</KV>)}
      </div>
      <Seal style={ap(lt, 15, 0.6)}>Seal · hybrid post-quantum · verifies</Seal>
    </Win>
  );
}

/* ═════════════════ Film 09 · Change one fact and it shows ═════════════════ */

const ENTRIES = ["Request", "Check", "Approvals", "Signature", "Settlement", "Ledger", "Seal"];

function Verify({ lt, title, runAt = 0.6, step = 0.9, failAt, typing }) {
  const reached = Math.floor((lt - runAt) / step);
  return (
    <Win title={title} tab="Evidence">
      <ol className="chain">
        {ENTRIES.map((e, i) => {
          const checked = reached >= i && (failAt === undefined || i < failAt);
          const failed = failAt !== undefined && i === failAt && reached >= i;
          const dark = failAt !== undefined && i > failAt && reached >= failAt;
          return (
            <li key={e} className={`${checked ? "is-ok" : ""}${failed ? " is-fail" : ""}${dark ? " is-dark" : ""}`} data-z={i === 2 ? "e3" : undefined}>
              <i aria-hidden="true">{failed ? "✕" : checked ? "✓" : dark ? "·" : i + 1}</i>
              <b>{e}</b>
              {i === 2 && typing !== undefined && <span className="chain__val">{typing}</span>}
              {dark && <span className="chain__val">not verified</span>}
            </li>
          );
        })}
      </ol>
      {failAt === undefined
        ? <div className="count count--ok" style={ap(lt, runAt + step * 7)}><span aria-hidden="true">✓</span> Verified · 7 of 7 entries intact</div>
        : <div style={ap(lt, runAt + step * (failAt + 1))}>
            <Banner tone="no">Fails at entry 3 · approver changed after sealing</Banner>
            <div className="kvs kvs--2"><KV k="Recorded">{X.approvers[1]} 10:21</KV><KV k="Found">{X.proposer} 10:21</KV></div>
          </div>}
    </Win>
  );
}

const F09Run = ({ lt }) => <Verify lt={lt} title={`Verify · ${X.record}`} />;
function F09Edit({ lt }) {
  const from = `${X.approvers[1]} 10:21`, to = `${X.proposer} 10:21`;
  const del = Math.floor(clamp((lt - 1.5) / 1.6) * from.length);
  const txt = lt < 3.2 ? from.slice(0, from.length - del) : typed(lt, 3.2, to, 12);
  return <Verify lt={-99} title="Verify · altered copy" typing={<span className="typing">{txt}<b className="caret" aria-hidden="true" /></span>} />;
}
const F09Fail = ({ lt }) => <Verify lt={lt} title="Verify · altered copy" failAt={2} runAt={0.4} step={0.8} typing={`${X.proposer} 10:21`} />;

/* ═════════════════ Film 10 · Compromise Q², move nothing ═════════════════ */

function F10Cols({ lt }) {
  const cols = [
    ["Stays with you and your signer", ["Keys", "Signing", "Approving", "Starting a movement"], "you"],
    ["What Q² holds", ["Approvals and check results", "Transaction references", "The sealed record"], "q2"],
    ["Never reaches Q²", ["Key material", "Credentials", "Personal data"], "never"],
  ];
  return (
    <div className="cols">
      {cols.map(([h, items, k], c) => (
        <div key={h} className={`col col--${k}`} style={ap(lt, 0.4 + c * 1.6)}>
          <h4>{h}</h4>
          <ul>{items.map((it, i) => <li key={it} style={ap(lt, 1 + c * 1.6 + i * 0.5)}><span aria-hidden="true">{k === "never" ? "✕" : k === "you" ? "●" : "○"}</span>{it}</li>)}</ul>
        </div>
      ))}
    </div>
  );
}

function F10Members({ lt }) {
  const rows = [
    [X.approvers[0], ["✓", "✓", "✓", "✓"]],
    [X.approvers[1], ["✓", "✓", "✓", "✓"]],
    ["Q²", ["✓", "✕", "✕", "✕"]],
  ];
  return (
    <Win title="Signer · members" w={940}>
      <table className="tb tb--grid">
        <thead><tr><th>Member</th><th>Read</th><th>Propose</th><th>Approve</th><th>Sign</th></tr></thead>
        <tbody>
          {rows.map(([n, cells], i) => (
            <tr key={n} className={i === 2 ? "is-q2" : ""} style={ap(lt, 0.4 + i * 0.6)}>
              <td><b>{n}</b></td>
              {cells.map((c, j) => {
                const at = i === 2 ? 3 + j * 1.1 : 0.4 + i * 0.6;
                return <td key={j} data-z={i === 2 && j === 2 ? "crosses" : undefined}><span className={`yn yn--${c === "✓" ? "y" : "n"}`} style={ap(lt, at, 0.3, 6)}>{c} <small>{c === "✓" ? "yes" : "no"}</small></span></td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Win>
  );
}

/* ═════════════════ The films ═════════════════ */

const cold = (q, who) => ({ d: 4, kind: "cold", q, who });
const end = (line, d = 8) => ({ d, kind: "end", line });

export const FILM_DATA = {
  "one-record": {
    beadLabels: ["Check", "Approved", "Approved", "Signed", "Settled", "Booked", "Sealed"],
    scenes: [
      cold("Who approved that?", "An auditor"),
      { d: 10, S: NewMovement, cap: "An analyst asks to send a two million dollar loan.", thread: { show: true, line: 1 } },
      { d: 12, S: F01Check, cap: "Q² checks it against the fund's own rules, and the record begins.", zoom: [{ at: 0.6, in: 1, hold: 2.6, out: 1, s: 1.32, x: "28%", y: "18%" }], thread: { beads: 1, beadAt: 1.2 } },
      { d: 12, S: F01Approve, cap: "Two partners approve the exact transaction.", thread: { beads: 3, beadAt: 3.4, beadGap: 3.6 } },
      { d: 14, S: F01Cuts, cap: "The signer signs. The chain settles. The administrator books. Nothing changes for them.", thread: { beads: 6, beadAt: 1.1, beadGap: 4 } },
      { d: 10, S: FullRecord, cap: "Seven facts. One record. Sealed.", zoom: [{ at: 0, in: 0, hold: 0.3, out: 1.8, s: 1.22, x: "50%", y: "40%" }], thread: { beads: 7, beadAt: 2.2, sealAt: 2.2 } },
      end("Who approved that? Prove it in minutes."),
    ],
  },
  refused: {
    scenes: [
      cold("Can't someone just send it to a new address?", "An investor's diligence team"),
      { d: 8, S: F02Try, cap: "Someone tries.", thread: { show: true, line: 0.45, beads: 1, beadAt: 6.8 } },
      { d: 14, S: F02Refused, cap: "A payment to an address nobody registered. Refused before it reaches the signer.", zoom: [{ at: 1.2, in: 1, hold: 3, out: 1, s: 1.28, x: "30%", y: "8%" }], thread: { breakAt: 0.8 } },
      { d: 14, S: F02Limit, cap: "A second loan would take one borrower past the fund's limit. Refused.", zoom: [{ at: 1, in: 1, hold: 3.4, out: 1, s: 1.22, x: "60%", y: "45%" }], thread: { mend: true, line: 0.5, beads: 1, beadAt: 0.1, breakAt: 3.4 } },
      { d: 12, S: F02List, cap: "Every refusal is kept. It proves the control worked." },
      end("What fails a check never reaches the signer."),
    ],
  },
  proposer: {
    threadEnd: "Signer",
    scenes: [
      cold("What if it is one of us?", "A managing partner"),
      { d: 12, S: F03Try, cap: "The person who asked tries to approve. She cannot.", thread: { show: true, line: 0.25 } },
      { d: 12, S: F03One, cap: "One approval is not enough.", thread: { beads: 1, beadAt: 1.3, line: 0.55 } },
      { d: 14, S: F03Two, cap: "Two named people, each on their own device. On the record.", thread: { beads: 2, beadAt: 1.7, line: 1 } },
      end("Two named people. Never the proposer."),
    ],
  },
  "approver-sees": {
    scenes: [
      cold("What did I actually sign?", "An approver, the morning after"),
      { d: 18, S: F04Pins, cap: "The amount and the destination come from the transaction itself, not from a description.", thread: { show: true, line: 1 } },
      { d: 12, S: F04Hold, cap: "Where the destination came from. Which rule allows it. Who asked.", zoom: [{ at: 0.4, in: 1, hold: 3.6, out: 0.8, s: 1.4, x: "50%", y: "38%" }, { at: 6.2, in: 0.8, hold: 3.6, out: 1, s: 1.4, x: "50%", y: "60%" }] },
      { d: 10, S: F04Press, cap: "Her approval covers this exact transaction, and expires in minutes.", thread: { beads: 1, beadAt: 1.5 } },
      { d: 12, S: F04Second, cap: "A second request says “routine transfer”." },
      { d: 12, S: F04Warn, cap: "It would hand over the wallet. There is no Approve button.", zoom: [{ at: 0.6, in: 1, hold: 7, out: 1.2, s: 1.3, x: "50%", y: "56%" }], thread: { breakAt: 1.2 } },
      end("People approve what will really happen.", 7),
    ],
  },
  "system-word": {
    scenes: [
      cold("The system said it was approved.", "An operations lead"),
      { d: 12, S: F05Arrive, cap: "A trusted internal service asks for a payment.", thread: { show: false } },
      { d: 14, S: F05Refused, cap: "It says a partner approved. There is no signature from his key. Refused.", zoom: [{ at: 1.4, in: 1, hold: 3, out: 0.8, s: 1.2, x: "30%", y: "30%" }, { at: 7.4, in: 0.8, hold: 3.4, out: 1, s: 1.2, x: "30%", y: "52%" }] },
      { d: 12, S: F05Month, cap: "Every movement is graded by the proof behind it." },
      { d: 10, S: F05Bar, cap: "An auditor sees the share at each grade, and the trend." },
      end("The record never vouches for a claim."),
    ],
  },
  "rule-change": {
    scenes: [
      cold("Who changed the limit?", "A risk officer"),
      { d: 10, S: F06Add, cap: "Someone adds a new destination.", thread: { show: true, line: 1 } },
      { d: 14, S: F06History, cap: "The change is kept: who, when, before and after.", zoom: [{ at: 0.8, in: 1, hold: 6.4, out: 1, s: 1.18, x: "50%", y: "30%" }], thread: { beads: 1, beadAt: 1 } },
      { d: 12, S: F06Propose, cap: "Two minutes later the same person tries to pay it.", thread: { beads: 2, beadAt: 10.4 } },
      { d: 12, S: F06Refused, cap: "Refused. New destinations wait two days, and someone else pays them.", thread: { breakAt: 1.2 } },
      end("Changes to authority wait, and need a second person."),
    ],
  },
  "went-around": {
    slots: 3,
    beadLabels: ["10:24 · matched", "13:10 · matched", ""],
    scenes: [
      cold("What if they go around us?", "A security lead"),
      { d: 12, S: F07Arc, cap: "A payment is started directly at the signer.", thread: { show: false } },
      { d: 12, S: F07Alert, cap: "It settles with no record behind it. Flagged as it settles.", zoom: [{ at: 2, in: 1, hold: 4, out: 1, s: 1.4, x: "30%", y: "50%" }] },
      { d: 12, S: F07Day, cap: "Every outflow is matched to its authority. This one has none.", thread: { show: true, line: 1, beads: 2, beadAt: 0.9, beadGap: 1, strayAt: 2.6 } },
      end("No record behind it? Flagged as it settles.", 10),
    ],
  },
  evidence: {
    beadLabels: ["Asked", "Rule", "Approved", "Signed", "Settled", "Booked", "Sealed"],
    scenes: [
      cold("Can you send me the evidence by Friday?", "An auditor"),
      { d: 10, S: F08Desk, cap: "Today: signer logs, the ledger, chat and screenshots.", thread: { show: false } },
      { d: 16, S: F08Export, cut: true, cap: "With the record: choose the movement and export.", zoom: [{ at: 4, in: 1, hold: 8, out: 1, s: 1.18, x: "75%", y: "78%" }] },
      { d: 20, S: F08Pack, cap: "Who asked. Which rule. Who approved. What was signed. What settled. Where it was booked.", thread: { show: true, line: 1, beads: 7, beadAt: 1, beadGap: 2.2, sealAt: 15 } },
      end("One sealed export per movement.", 10),
    ],
  },
  tamper: {
    beadLabels: ENTRIES,
    scenes: [
      cold("How do I know nobody edited this?", "A regulator"),
      { d: 10, S: F09Run, cap: "A sealed record verifies entry by entry.", thread: { show: true, line: 1, beads: 7, beadAt: 0.6, beadGap: 0.9, sealAt: 6.2 } },
      { d: 10, S: F09Edit, cap: "Change one approver's name in a copy.", zoom: [{ at: 0.6, in: 1, hold: 7, out: 1, s: 1.3, x: "36%", y: "30%" }] },
      { d: 12, S: F09Fail, cap: "It fails at that entry, and at every entry after it.", thread: { darkAt: 2.4, darkFrom: 2 } },
      end("Change one fact and it shows.", 9),
    ],
  },
  "no-keys": {
    scenes: [
      cold("Aren't you one more thing to hack?", "A security lead"),
      { d: 14, S: F10Cols, cap: "The keys stay with you and your signer.", thread: { show: false } },
      { d: 24, S: F10Members, cap: "At the signer, Q² can read. It cannot propose, approve or sign.", zoom: [{ at: 7.6, in: 1.2, hold: 12, out: 1.4, s: 1.22, x: "62%", y: "66%" }] },
      end("Q² holds no keys. Taking it over moves nothing."),
    ],
  },
};

// Compile a film: absolute start times, total length and thread events.
export function compile(slug) {
  const f = FILM_DATA[slug];
  let t = 0;
  const scenes = f.scenes.map((s) => { const o = { ...s, start: t }; t += s.d; return o; });
  const ev = [];
  let beads = 0;
  for (const s of scenes) {
    const th = s.thread || {};
    if (s.kind === "cold") ev.push({ t: s.start, k: "show", v: false });
    if (th.show !== undefined) ev.push({ t: s.start, k: "show", v: th.show });
    if (th.mend) ev.push({ t: s.start, k: "mend" });
    if (th.line !== undefined) ev.push({ t: s.start + (th.lineAt || 0), k: "line", v: th.line });
    if (th.beads !== undefined) {
      for (let i = beads; i < th.beads; i++) ev.push({ t: s.start + (th.beadAt ?? 0.6) + (i - beads) * (th.beadGap ?? 0.5), k: "bead", v: i });
      beads = Math.max(beads, th.beads);
    }
    if (th.breakAt !== undefined) ev.push({ t: s.start + th.breakAt, k: "break" });
    if (th.sealAt !== undefined) ev.push({ t: s.start + th.sealAt, k: "seal" });
    if (th.darkAt !== undefined) ev.push({ t: s.start + th.darkAt, k: "dark", v: th.darkFrom });
    if (th.strayAt !== undefined) ev.push({ t: s.start + th.strayAt, k: "stray" });
  }
  ev.sort((a, b) => a.t - b.t);
  const slots = f.slots || Math.max(beads, f.beadLabels?.length || 0, 1);
  return { slug, scenes, total: t, ev, slots, beadLabels: f.beadLabels, threadEnd: f.threadEnd };
}

