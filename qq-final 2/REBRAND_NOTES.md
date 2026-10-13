# Q Squared rebrand · notes

Branch `rebrand-oct-2026`. Preview only. Not merged, not promoted to production.
Approval needed from Gianluca, Chee and Sohil.

## What changed

**Name.** The product is **Q Squared**, written **Q²** in running text. "Quantum Qustody" and "custody" are gone from the product name, the logo, the wordmark, page titles, meta, the platform chrome, the Design Partner intake and the research articles. The legal entity *Quantum Qustody Inc.* is kept only where a legal statement needs it (see open questions).

**Logo.** A new hand-drawn SVG mark: a Q whose tail runs out as the line you sign on and ends in a seal. Three directions are in `public/brand/explorations/`; A was chosen (rationale on `/brand`). Delivered: mark, horizontal and stacked lockups, each light and dark; `favicon.svg` (adapts to OS scheme, drops the superscript below 24 px), `favicon-32.png`, `apple-touch-icon.png`, `icon-192/512.png`, `site.webmanifest`, `og.png` (1200x630).

**Design system.** `src/styles/tokens.css` is the single source for colour, type, space, radius and motion, with light and dark themes. Purple and white carry the brand; ink carries text; a warm signal is reserved for approved and sealed moments.

**Public site** (`src/site/`). Dark-first in every OS theme (the platform keeps its own toggle). The landing page is a scroll story:

1. Hero: *Self-custody, built for regulated finance.* For vaults, funds and AI agents. Beside a real-time 3D scientific atom: hairline Bohr orbits, a proton and neutron nucleus, and a point cloud sampled from the hydrogen 2p orbital density, captioned as Fig. 1 (three.js, transparent canvas) that turns with the pointer and with scroll.
2. One line whose words light up as you scroll: *You hold the keys. Q² proves every decision made with them.*
3. The three sourced proof points, with counters.
4. A gapless bento of five cards with mathematical figures, the moat: keys stay yours, post-quantum seals, agents over MCP (propose only), one record across custodians, deploy where your keys live.
5. How it works, pinned: Approve, Record, Seal. The figure on the left changes with the step (quorum, hash chain, lattice); a rail fills as you scroll; the live signed record sits in step 2.
6. Where Q² sits (agent rails above, your keys below, readers to the side).
7. The rules as stacking cards (maps to, never compliant with).
8. Pricing and a comparison with Fireblocks (see below).
9. Audiences, developers (TypeScript and MCP tabs), and a closing section with a second atom, the design partner stages and the enquiry form.

Also `/research`, `/research/:id`, `/brand` (with `/brand/explorations`) and `/design-partner` as real URLs. The nav is a floating pill with a full-screen menu on small screens.

**Motion.** Reveals use IntersectionObserver. Scrubbed effects use GSAP ScrollTrigger, loaded after first paint. three.js (175 kB gzip) loads on the first interaction, renders only while the atom is on screen, and falls back to an SVG drawing of the same atom. With reduced motion, nothing animates and all content is visible.

**Pricing.** At the CTO's instruction, Q² charges the same as Fireblocks' published prices: Sandbox free, Essentials $999 per month, Custom from $36,000 per year. Essentials mirrors Fireblocks Essentials: $1,000,000 quarterly volume, 0.20% per transaction above it, 5 users, 2 workspaces. The comparison table shows Fireblocks figures exactly as published at fireblocks.com/pricing on 13 October 2026, with the source linked. Where an item does not appear on that page, the table says "Not listed" and the footnote explains that it may still be available from Fireblocks on request.

**Logo in the site chrome.** The nav and footer show the Q² mark alone, without the wordmark. The full lockups remain on `/brand`.

**Figures.** Imagery is mathematics drawn by hand in SVG (`src/site/Figures.jsx`): key shares as a polynomial, f(x) = s + a₁x + a₂x², f(0) = s; the quorum rule Σ vᵢ ≥ k (2 of 3); a hash chain, hᵢ = H(hᵢ₋₁ ‖ rᵢ); and the ML-DSA module lattice, t = A·s₁ + s₂ (mod q). They draw themselves in on scroll. The earlier generated photographs were removed. Documented on `/brand#figures`.

**Platform.** Every sandbox function is unchanged. It keeps its dark ink surface on the new tokens: new mark, Q Squared wordmark, solid purple buttons, no gradient text or glows, calmer labels. Tailwind's purple and fuchsia scales map to the brand purple, so all existing screens adopt the brand.

**Build and performance.** Tailwind is compiled at build time (the runtime CDN script is gone). The public site no longer downloads the platform: ethers, the Coinbase SDK, Supabase and jsPDF are on-demand chunks. Public entry: 185 kB (59 kB gzip), was one 1.0 MB bundle.

## Results

| Route | Performance | Accessibility | Best practices | SEO |
| --- | --- | --- | --- | --- |
| Before, `/` (production) | 70 | 93 | 100 | 91 |
| After, `/` (with objects) | 99 | 100 | 100 | 100 |
| After, `/research` | 100 | 100 | 100 | 100 |
| After, `/brand` | 100 | 100 | 100 | 100 |

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
12. **Pricing and the Fireblocks comparison.** Prices were set to match Fireblocks' published prices on instruction. Fireblocks' $999 is described on its page as "for up to 6 months"; Q²'s page does not limit it. Naming a competitor and its prices is comparative advertising: please have counsel review the table and footnote before this goes public, and re-check fireblocks.com/pricing on the day of launch.
13. **MCP server.** The page describes an MCP server with three tools (propose_transfer, get_decision, get_record), labelled preview. Confirm the names and that it will exist at launch, or relabel it as planned.

## Could not verify

- The FSB quote ("difficult or impossible" to reverse, 10 June 2026), the EY figure (61%, January 2026) and EO 14412 are used exactly as supplied in the brief. None could be checked from here.
- That DORA "requires tamper-proof logs" is used as supplied; the page says the product *maps to* it.
- x402, AP2 and Visa TAP are named as examples of agent rails, not partners, as instructed.
- `@q2/sdk` in the code sample is illustrative. No package is published; the sample is labelled as a preview API.
- The lockup SVG files set the wordmark with `<text>` in Schibsted Grotesk with system fallbacks. For print, outline them in a design tool.
- Signed-in sandbox flows (wallet, Sepolia send, governance) were not exercised end to end, because I do not create accounts. The platform code is unchanged apart from styling, the logo and the boot handover; please run one sandbox sign-in on the preview.
