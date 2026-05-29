# Governed Wallet Architecture — Design Doc

Status: **DRAFT — review branch only.** Not on production. Reviewers: Gianluca, Sohil, Chee.

This document captures the target architecture for Quantum Qustody's governed
smart-account model. It is the design artifact for Phase 5 of the testnet
feedback work order. The UI and state machine ship as scaffold + design;
on-chain ERC-4337 deployment, controlled ECDSA release, session keys, and
quantum-resistant signing remain mocked behind flags for this pass.

---

## The control principle

> Governance changes must be governed at least as strictly as asset movements.

Every primitive in this design follows from that line. If approvers can be
swapped, thresholds lowered, allowlists widened, modules added or recovery
rerouted without the same level of approval required to move an asset, the
smart account is a security theatre. The architecture is deliberately
symmetrical: the same approver set, threshold and audit trail govern both
movement and modification.

---

## Two addresses, two responsibilities

The user has two addresses inside Quantum Qustody, and the distinction is
deliberately visible in the UI.

The **Root EOA** is the wallet the user connects via MetaMask (or Coinbase,
Rabby, Brave). It is owned by the human, recoverable by the human, and never
holds the institution's assets. Its purpose is to be the ownership and
recovery anchor for the smart account: it can deploy, ultimately recover, and
in some emergency paths, halt — but it cannot move funds. If a tester sends
ETH directly to the Root EOA, those funds are not protected by the smart
account's rules. The UI warns against this; the architecture treats the Root
EOA as a key, not a vault.

The **Smart Account Address** is an ERC-4337 contract account, deployed and
owned by the Root EOA, but operating only through validated user-operations.
This is where institutional assets sit. Every movement out of the Smart
Account passes through the validation logic the policy engine installed at
deploy time — threshold checks, allowlist checks, amount ceilings, time
windows. No external dApp, no random call, no rotated session key can bypass
this validation.

The product surface is also two-sided. The wallet card on Digital Assets
shows the Root EOA as a recovery anchor; the Asset Boundary view shows the
Smart Account Address as the governed vault. Funding flows are routed to the
Smart Account; recovery flows touch the Root EOA.

---

## State machine

A new account walks through five states.

`Disconnected → EOA_Connected → SmartAccount_Pending → Policy_Draft → Policy_Active`

`EOA_Connected` is the result of connect-wallet. The Root EOA is bound; no
smart account exists yet. `SmartAccount_Pending` is reached when the user
opts to deploy: the system computes the counterfactual smart account address,
stages a deploy user-operation, but the account does not exist on-chain yet.
`Policy_Draft` is reached once the user (or wizard) defines a draft policy —
approvers, threshold, limits, allowlists. The smart account is now staged
with a policy but not yet activated. `Policy_Active` is the steady state:
approvers have verified, the activation request has been approved, and the
smart account is governed. Funds are only accepted once `Policy_Active`.

A regression is possible but must be governed: leaving `Policy_Active` —
changing approvers, thresholds, modules, recovery — requires the same M-of-N
approval the active policy requires for movements. This is enforced both in
the UI (a "Policy Change Proposal" surface) and on-chain (policy module
guards on the smart account).

---

## Sequencing rule (Funding lock)

Funding is locked until both conditions are true:

1. Policy is `Active`.
2. The approver set has been verified — every Approver-role member is in
   user_state `Active`, not `Pending` / `Disabled` / `Expired` / `Revoked`.

If a tester attempts to fund (or send to) the Root EOA before activation,
the UI shows an inline warning explaining that assets sent there are not
governed and at the discretion of the EOA's recovery flow. If a tester
attempts to fund the Smart Account before activation, the UI blocks the
action with the message "Funding locked until Governance Activation
completes."

In the scaffold, this is enforced UI-side via a derived flag
`policy.fundingLocked = policy.status !== "Active" || approversNotAllActive`.
In the production build, the same flag drives a contract-level check inside
the smart account's deposit handler.

---

## Roles, states, thresholds

The role set is intentionally minimal:

**Admin** — can draft policy and propose policy changes. Counts toward
threshold *only* if also explicitly assigned the Approver role.

**Requester** — initiates movement requests.

**Approver** — votes on movement requests and on policy changes. Only
Approver-role members in user_state `Active` count toward threshold.

**Observer** — view-only. Never counts toward threshold under any
circumstance.

User states (`Pending`, `Active`, `Disabled`, `Expired`, `Revoked`) are
already enumerated in migration 009. The implication for threshold maths is
simple: only the intersection of {role = Approver, state = Active, in policy
version} contributes. A pending invitee — however well-intentioned — is not
a quorum member.

Threshold is `M-of-N` where N is the count of Active Approvers in the policy
version. The default for MVP is `2-of-3`. An optional `required_oversight`
gate adds a separately tracked Observer-role acknowledgement before
high-risk actions; this is configured per policy, not per movement.

---

## Transaction execution controls

Every user-operation against the smart account is validated by an installed
module at three layers.

**Authority layer.** The user-operation's signature is checked against the
Approver set defined in the active policy version. Threshold is met or the
operation reverts.

**Policy layer.** Amount ceiling, destination allowlist (when set),
time-of-day window (when set), and asset whitelist are evaluated. Any
mismatch reverts.

**Module layer.** Custom modules (e.g., a "session key" module for routine
operational sends within a daily cap) operate strictly within the bounds the
policy installed them with. Modules cannot be added or modified without the
same M-of-N approval.

In production, the signing primitive transitions from ECDSA-only ("Current
Trust") to a controlled ECDSA release + session-key model, then a
quantum-resistant primitive (ML-DSA-65) attached to the same validation
flow. The architecture is invariant across that transition because the
validation logic is in the policy module, not the signature scheme.

---

## What's mocked for this pass

The Phase 5 scaffold ships the state-machine, the boundary distinction in
the UI, the funding-lock guard, and the design doc you are reading. It does
NOT ship: a real ERC-4337 entrypoint, a real bundler integration, real
session-key signing, real controlled ECDSA release, or any of the
quantum-resistant primitives. Those are explicitly out of scope for this
pass and are flagged with a `MOCK` badge in the UI. The state machine
matches what the live build will do; the chain interaction is staged.

A future migration will add the on-chain ABI bindings, a bundler
configuration table, and a session-key table. The shape of these tables is
already implied by the policy_versions and policy_approvals tables added in
migration 009.

---

## Mobile

All Phase 5 governance surfaces (boundary view, funding-lock messaging,
policy-status banners, approver list) are designed to be readable at 375px.
The scaffold uses the same drawer pattern as the rest of the app: the
governance panel collapses to a tap-to-expand strip on narrow viewports,
and the policy-status badge stays in the always-visible header.

---

## Review questions for the team

1. Is the Admin role correct as defined — explicitly *not* counting toward
   threshold unless separately assigned Approver?
2. Should `required_oversight` be a per-policy global, or per-action?
   (Argued both ways; defaulting to per-policy for simplicity in MVP.)
3. The funding-lock currently allows the Root EOA to hold non-governed
   funds (with a warning). Should we block funding to the Root EOA
   altogether? Pro: cleanest UX. Con: removes legitimate "I'm staging gas"
   use case.
4. For policy changes, should the M of M-of-N be raised relative to
   movements? The current design treats them equally. A stronger model
   would require `M+1` for policy changes affecting threshold itself, to
   prevent threshold-lowering attacks via a bare-quorum.
5. What is the timeout / expiration on a proposed policy change? Current
   design has no auto-expiry; an attacker who compromises one Approver
   could stash a long-pending malicious proposal. Suggest 7 days.

---

## File pointers

- Schema: [supabase-migrations/009_governance_model.sql](../supabase-migrations/009_governance_model.sql) — policy_versions, policy_approvals, proposer-cannot-solo-approve trigger.
- UI scaffold: `src/App.jsx` — `PolicyPanel` component, governance_role badges in Team, boundary section in Digital Assets (next commit).
- Wallet boundary: `src/sepolia.js` — Root EOA reads only; smart account address derivation lives in a future `src/smartAccount.js`.

---

This doc is the review artifact. Comments inline as GitHub PR suggestions
or in Notion; flag anything that breaks the control principle.
