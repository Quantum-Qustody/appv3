import { useEffect, useRef, useState } from "react";
import { EXAMPLE } from "./filmsList.js";

// The Movement Record for the worked example used across the site, the
// whitepaper and the films: one 2,000,000 USDC loan. Each fact lands in turn,
// then the record is sealed. Names are invented; the caption says so.
const ROWS = [
  ["Asked by", `${EXAMPLE.proposer}, analyst`],
  ["Rule", EXAMPLE.rule],
  ["Approved", EXAMPLE.approvers.join(" · ")],
  ["Signed", "Matches what was approved"],
  ["Settled", `${EXAMPLE.amount} to ${EXAMPLE.borrower}`],
  ["Booked", `Ledger entry ${EXAMPLE.ledger}`],
];

const reduced = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function SignedRecord() {
  const total = ROWS.length + 1; // the seal is the last fact
  const [stage, setStage] = useState(() => (reduced() ? total : 0));
  const timers = useRef([]);

  const play = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (reduced()) { setStage(total); return; }
    setStage(0);
    for (let i = 1; i <= total; i++) timers.current.push(setTimeout(() => setStage(i), 450 + i * 520));
  };

  useEffect(() => { play(); return () => timers.current.forEach(clearTimeout); }, []);

  const sealed = stage >= total;
  return (
    <figure style={{ margin: 0 }} aria-label="Example Movement Record for a 2,000,000 USDC loan">
      <div className="record">
        <div className="record__head">
          <span className="record__title">Movement record</span>
          <span className="record__id">{EXAMPLE.record}</span>
        </div>
        <p className="record__send">Send {EXAMPLE.amount}</p>
        <dl className="record__rows">
          {ROWS.map(([k, v], i) => (
            <div key={k} className={`record__row ${stage > i ? "is-in" : ""}`}>
              <dt><i className="record__tick" aria-hidden="true" />{k}</dt>
              <dd className={stage > i ? "" : "is-pending"}>{stage > i ? v : "waiting"}</dd>
            </div>
          ))}
        </dl>
        <div className={`record__sealbar ${sealed ? "is-on" : ""}`}>
          <span className="record__sealdot" aria-hidden="true" />
          {sealed ? "Sealed · ready for your auditor" : `${Math.min(stage, ROWS.length)} of ${ROWS.length} facts recorded`}
        </div>
      </div>
      <figcaption className="record__caption">
        <span role="status" aria-live="polite">Example record. Names are invented.</span>
        <button type="button" onClick={play}>Replay</button>
      </figcaption>
    </figure>
  );
}
