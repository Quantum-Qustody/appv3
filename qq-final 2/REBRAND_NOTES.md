# Q Squared rebrand · notes

Branch `rebrand-oct-2026`. Preview only. Not merged, not promoted to production.
Approval needed from Gianluca, Chee and Sohil.

## What changed

**Name.** The product is **Q Squared**, written **Q²** in running text. "Quantum Qustody" and "custody" are gone from the product name, the logo, the wordmark, page titles, meta, the platform chrome, the Design Partner intake and the research articles. The legal entity *Quantum Qustody Inc.* is kept only where a legal statement needs it (see open questions).

**Logo.** A new hand-drawn SVG mark: a Q whose tail runs out as the line you sign on and ends in a seal. Three directions were drawn; A was chosen. The explorations are kept off the public site in `docs/brand-explorations/`. Delivered: mark, horizontal and stacked lockups, each light and dark; `favicon.svg` (adapts to OS scheme, drops the superscript below 24 px), `favicon-32.png`, `apple-touch-icon.png`, `icon-192/512.png`, `site.webmanifest`, `og.png` (1200x630).

**Design system.** `src/styles/tokens.css` is the single source for colour, type, space, radius and motion, with light and dark themes. Purple and white carry the brand; ink carries text; a warm signal is reserved for approved and sealed moments.

**Public site** (`src/site/`). Dark-first in every OS theme (the platform keeps its own toggle). Reworked on 14 Oct 2026 to implement the website review of 13 Oct (Chee Yang). Category line, page title, meta and footer: *the independent authority record for digital assets*.

Home, in the review's order:
1. Hero: *You hold the keys. Q² proves every decision made with them.* Subhead as proposed; calls to action *Book a 30-minute diagnostic call* and *See how it works*; the live sample authority record is the visual.
2. Why now: EY 61% (several custodians), the SEC custody proposal's two-person authorisation, the FSB "difficult or impossible" quote. Each sourced.
3. Who it is for: fund managers, custodians/CASPs/EMIs, teams running agents; five rows each (who, problem, how they cope, why switch, success).
4. How it works, pinned: Approve, Record, Seal, Disclose, each with a status label and a mathematical figure.
5. Where Q² sits: proposers, Q², the executing stack (signers, custodians, smart accounts, venues, fund administrator) and six reader types. Names are labelled as examples.
6. Capabilities: eight cards, each labelled Sandbox, In design or Roadmap.
7. Regulation: four rules in their own words as stacking cards, linking to `/regulation`.
8. Developers: preview API, sandbox only.
9. Start: the ladder (diagnostic, pilot, subscription) with a link to pricing, and the enquiry form.

`/pricing`: Sandbox free; Diagnostic from EUR 5,000; Pilot from USD 20,000, credited to year one; Subscription from USD 24,000 a year. `/regulation`: every rule in its own words with what Q² gives you, status and who it binds; on demand, not reconciled; what existing rules say about quantum; where the rules are heading. `/research`: four new pieces, one article retired, two rewritten, titles corrected. `/brand`: explorations and the notes reference removed.

**Pricing.** The Fireblocks price match and comparison table were removed on review (category, price floor, per-transaction metering, comparative-advertising risk). The entry ladder replaces them.

**Status labels.** Sandbox (try it on testnet): approve, record, evidence on demand, cloud deployment. In design: refusals on record, selective disclosure, programmable controls (ERC-4337 is mocked in the sandbox), the crypto-agile seal (post-quantum is a setting in the sandbox, not real signing). Roadmap: in-region and on-premise. Nothing is labelled live.

**Motion and figures.** Reveals use IntersectionObserver; scrubbed effects use GSAP ScrollTrigger after first paint. Figures are hand-written SVG (`src/site/Figures.jsx`): quorum, hash chain, lattice (FIPS 204) and selective disclosure. The three.js atom remains only in the closing section, starting on first interaction. With reduced motion nothing animates.

**Logo in the site chrome.** The nav and footer show the Q² mark alone. The full lockups remain on `/brand`.

**Platform.** Every sandbox function is unchanged. It keeps its dark ink surface on the new tokens: new mark, Q Squared wordmark, solid purple buttons, no gradient text or glows, calmer labels. Tailwind's purple and fuchsia scales map to the brand purple, so all existing screens adopt the brand.

**Build and performance.** Tailwind is compiled at build time (the runtime CDN script is gone). The public site no longer downloads the platform: ethers, the Coinbase SDK, Supabase and jsPDF are on-demand chunks. Public entry: 185 kB (59 kB gzip), was one 1.0 MB bundle.

## Results

| Route | Performance | Accessibility | Best practices | SEO |
| --- | --- | --- | --- | --- |
| Before, `/` (production) | 70 | 93 | 100 | 91 |
| After, `/` | 95 | 100 | 100 | 100 |
| After, `/pricing` | 97 | 100 | 100 | 100 |
| After, `/regulation` | 98 | 100 | 100 | 100 |

Lighthouse 12, mobile emulation, against the production build. Home LCP 2.0 s, CLS 0. No element exceeds the viewport at 360, 390, 768, 1440 or 1920 px on any public route (checked by script, not only by scroll width). Screenshots: `docs/rebrand/before/` and `docs/rebrand/after/`.

**Verified working on the preview build:** site to sandbox sign-in and back (no bounce); `/design-partner` deep link and gate (Supabase rejects bad credentials as expected); enquiry form validation (5 field errors on an empty submit); enquiry form end to end (one labelled test row stored, see open question 9).

## Tokens

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--q-paper` | #FBFAFD | #0F0C1F | Page |
| `--q-paper-2` | #F4F2FA | #17132C | Raised panel, record |
| `--q-paper-3` | #EBE8F5 | #201B3A | Pressed, selected |
| `--q-ink` | #15112B | #F4F2FB | Text, headings (17.6:1) |
| `--q-ink-2` | #4A4562 | #C6C1DA | Secondary text (8.7:1) |
| `--q-ink-3` | #5F5978 | #A29CBA | Captions (6.3:1) |
| `--q-rule` | #E2DEEF | #2A2445 | Hairlines |
| `--q-rule-strong` | #CBC5E0 | #3B3460 | Borders, inputs |
| `--q-accent` | #5B3BEA | #AE9CFF | Links, primary action, focus (6.2:1 / 8.2:1) |
| `--q-accent-hover` | #4A2BD6 | #C3B6FF | |
| `--q-accent-ink` | #FFFFFF | #0F0C1F | Text on accent (6.4:1 / 8.2:1) |
| `--q-accent-soft` | #EEEAFE | #221C44 | Tinted fills |
| `--q-signal` | #F2B04A | #F2B04A | Approved and sealed only, under 5% of a page |
| `--q-signal-ink` | #5A2D00 | #1F1400 | Text on signal |
| `--q-signal-soft` | #FDF2DE | #2E2414 | |
| `--q-danger` | #B42318 | #FF8A80 | Errors |
| `--q-brand-*` | fixed | fixed | Canonical logo colours: purple #5B3BEA, purple on ink #C9BDFF, paper, ink, signal |

Type: `--font-display` Schibsted Grotesk, `--font-body` IBM Plex Sans, `--font-mono` IBM Plex Mono. Scale `--text-xs` to `--text-display` (fluid). Space `--space-1` to `--space-32` on a 4 pt grid. Radius 4 / 8 / 12. Motion `--ease-out`, `--ease-in`, `--ease-in-out`; 140 / 240 / 480 ms; all motion collapses under `prefers-reduced-motion`.

Platform variables (`--bg`, `--text`, `--panel`, `--border`) are in `src/index.css` and use the same palette.

## Open questions

1. **Legal entity, domain and handles.** Footer reads "© 2026 Q Squared. Operated by Quantum Qustody Inc., a Delaware corporation." The confidentiality clause in the intake still names Quantum Qustody Inc. The domain, email addresses and social handles are still `quantumqustody`. Is the company being renamed, and are new domain and handles planned?
2. **Executive Order number.** The brief cites EO 14412 for the 31 Dec 2031 deadline. The existing research article "Migration Has a Deadline" cites EO 14409 for the same move. One of them needs correcting.
3. **Proof-point links.** The three sources are shown as text. Please supply URLs for the FSB consultation (10 June 2026) and the EY survey (January 2026) so they can be linked.
4. **Email sender name.** The `design-partner-submit` function now defaults to "Q Squared" as the sender, but only after it is redeployed. Until then emails still say Quantum Qustody.
5. **Public enquiry form.** It reuses `design-partner-submit`, so enquiries land in `design_partner_responses` (partner = `inbound`) and email the team. There is no rate limit or captcha. A separate function with basic abuse protection is advisable before heavy promotion.
6. **Em dashes in existing copy.** New copy has none. The research articles, the sandbox screens and the Design Partner questionnaire (approved wording) still contain em dashes and were not rewritten.
7. **Sandbox copy.** Platform screens (How it works, User Guide) still describe the earlier "governed custody" positioning in places. Rename is done; a copy pass is not.
8. **What partners get.** "Founder-level support from diagnostic to production" was written for this page. Confirm it is an offer you want to make.
9. **Test data.** One enquiry labelled `[TEST] Rebrand preview check` was submitted to verify the form. Delete it with `delete from design_partner_responses where respondent_email = 'gdb@moodglobalservices.com' and partner = 'inbound';`
10. **Platform light theme.** The sandbox stays dark-first; its existing light toggle is unchanged. A full light theme for the platform is a separate piece of work.
11. **Self-custody positioning.** The page now says Q² "is not a custodian" and "never holds your keys or your assets", and that keys stay "in your own MPC or HSM". This follows the instruction to lead with self-custody. Please confirm it matches the product, including the managed cloud option.

12. **Research reviewers.** The review asks for a "Q² Research" byline plus a named reviewer. The bylines read "Q² Research"; add the reviewer names once someone has reviewed each piece.
13. **Book a call.** "Book a 30-minute diagnostic call" opens the enquiry form. If you have a calendar link, it can point there instead.
14. **Status labels.** Please confirm the Sandbox / In design / Roadmap assignments above against the product.
15. **Research pipeline.** The weekly draft pipeline in the review needs input before it is set up.

## Could not verify

- The FSB quote ("difficult or impossible" to reverse, 10 June 2026), the EY figure (61%, January 2026) and EO 14412 are used exactly as supplied in the brief. None could be checked from here.
- That DORA "requires tamper-proof logs" is used as supplied; the page says the product *maps to* it.
- x402, AP2 and Visa TAP are named as examples of agent rails, not partners, as instructed.
- `@q2/sdk` in the code sample is illustrative. No package is published; the sample is labelled as a preview API.
- The lockup SVG files set the wordmark with `<text>` in Schibsted Grotesk with system fallbacks. For print, outline them in a design tool.
- Signed-in sandbox flows (wallet, Sepolia send, governance) were not exercised end to end, because I do not create accounts. The platform code is unchanged apart from styling, the logo and the boot handover; please run one sandbox sign-in on the preview.
