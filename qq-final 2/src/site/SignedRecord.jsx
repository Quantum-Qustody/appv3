import { useEffect, useRef, useState } from "react";

// Illustrative data only. The caption under the record says so.
const RECORD = {
  id: "rec_7Q2KF9M4ZP",
  actor: "agent · treasury-rebalancer-02",
  mandate: "MND-0417 · Opportunistic sleeve, up to USD 250,000 per day",
  proposal: "Move 120,000 USDC to an allowlisted lending venue",
  policy: "pol-v3.2 · effective 2026-09-30",
  quorum: "2 of 3 · Treasury, Risk",
  timestamp: "2026-10-12T14:32:07Z",
  algorithm: "ML-DSA-65 (FIPS 204)",
  hash: "sha3-256 9c4e1a07b2f58d3e6a1c0b94f7d2e8a5",
};

// stage: 0 proposed · 1 approving · 2 approved · 3 recorded · 4 sealed
const STEPS = [
  { key: "approve", label: "Approve" },
  { key: "record", label: "Record" },
  { key: "seal", label: "Seal" },
];

const reduced = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function SignedRecord() {
  const [stage, setStage] = useState(() => (reduced() ? 4 : 0));
  const timers = useRef([]);

  const play = () => {
    timers.current.forEach(clearTimeout);
    if (reduced()) { setStage(4); return; }
    setStage(0);
    [700, 1500, 2300, 3200].forEach((t, i) => {
      timers.current.push(setTimeout(() => setStage(i + 1), t));
    });
  };

  useEffect(() => { play(); return () => timers.current.forEach(clearTimeout); }, []);

  // Approve is active at stage 1 and done at 2; Record active at 2, done at 3; Seal active at 3, done at 4.
  const stepState = (i) => (stage >= i + 2 ? "is-done" : stage >= i + 1 ? "is-active" : "");

  const quorumText = stage < 1 ? "0 of 3" : stage < 2 ? "1 of 3 · Treasury" : RECORD.quorum;
  const statusText = stage === 4 ? "Sealed" : stage === 3 ? "Recorded" : stage >= 2 ? "Approved" : stage === 1 ? "Awaiting quorum" : "Proposed by agent";

  return (
    <figure style={{ margin: 0 }} aria-label="Example of a signed authority record">
      <div className="record">
        <div className="record__head">
          <span className="record__title">Authority record</span>
          <span className="record__id">{stage >= 3 ? RECORD.id : "rec_pending"}</span>
        </div>
        <div className="record__steps" aria-hidden="true">
          {STEPS.map((s, i) => (
            <div key={s.key} className={`record__step ${stepState(i)}`}><i />{s.label}</div>
          ))}
        </div>
        <dl className="record__rows">
          <div className="record__row"><dt>Actor</dt><dd>{RECORD.actor}</dd></div>
          <div className="record__row"><dt>Mandate</dt><dd>{RECORD.mandate}</dd></div>
          <div className="record__row"><dt>Proposal</dt><dd>{RECORD.proposal}</dd></div>
          <div className="record__row"><dt>Policy version</dt><dd>{RECORD.policy}</dd></div>
          <div className="record__row"><dt>Quorum</dt><dd className={stage < 1 ? "is-pending" : ""}>{quorumText}</dd></div>
          <div className="record__row"><dt>Decision</dt><dd className={stage < 2 ? "is-pending" : ""}>{stage >= 2 ? <span className="ok">Approved</span> : "Pending"}</dd></div>
          <div className="record__row"><dt>Timestamp</dt><dd className={stage < 3 ? "is-pending" : ""}>{stage >= 3 ? RECORD.timestamp : "not yet recorded"}</dd></div>
          <div className="record__row"><dt>Signature</dt><dd className={stage < 4 ? "is-pending" : ""}>{RECORD.algorithm}</dd></div>
        </dl>
        <div className="record__foot">
          <span className="record__hash">{stage >= 3 ? RECORD.hash : "hash computed on record"}</span>
          <span className={`seal ${stage === 4 ? "is-on" : ""}`} aria-hidden={stage !== 4}>Sealed</span>
        </div>
      </div>
      <figcaption className="record__caption">
        <span role="status" aria-live="polite">Status: {statusText}. Illustrative record, not live data.</span>
        <button type="button" onClick={play}>Replay</button>
      </figcaption>
    </figure>
  );
}
