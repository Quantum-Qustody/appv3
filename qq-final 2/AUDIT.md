# Q² rebrand · audit of the current site

Branch `rebrand-oct-2026`, cut from `main` at `6ae57a3`. Written before any change.

Note on naming: the brief refers to `Quantum-Qustody/websitev1`. The code lives in
`Quantum-Qustody/appv3`, deployed by the Vercel project `websitev1` with root directory
`qq-final 2`. This branch follows that real setup.

## What the site is today

| Area | Finding |
| --- | --- |
| Framework | Vite 6 + React 18 single-page app. One 2,775-line `src/App.jsx` holds the landing page, auth, setup wizard and the whole sandbox platform. |
| Routing | No router and no URL routes. Views switch on React state (`phase`, `activeView`). No `vercel.json`, so deep links such as `/brand` would 404. |
| Styling | Tailwind loaded from `cdn.tailwindcss.com` at runtime (a render-blocking script), plus `src/index.css`. Dark only. Purple to fuchsia to indigo gradients, glass panels, monospace "terminal" labels (`[ SECTION ]`, `ENTER_SANDBOX`). |
| Type | Inter as a Google Sans stand-in, JetBrains Mono. |
| Brand assets | `public/qq-logo.svg` and `public/favicon.svg` are the same 19 KB traced vector (66 paths, masks). No wordmark file, no apple-touch-icon, no OG image. |
| Meta | Title only (`Quantum Qustody — MVP Alpha Sandbox`). No description, OG, Twitter tags, sitemap or robots.txt. |
| Copy | Positioning is "institutional custody" ("Not Another Custody Platform", "Beyond Custody"). Hero visual is an orbiting atom. Em dashes throughout. |
| Analytics | None found (no Vercel Analytics, GA, Plausible or PostHog). |
| Legal | No legal pages and no privacy link exist on the current site. The confidentiality notice lives inside the Design Partner intake. Footer: X, Instagram, LinkedIn, "Design Partner", "© 2026 QUANTUM QUSTODY". |
| Forms | 1) Sandbox sign in / sign up (Supabase Auth). 2) Design Partner intake, gated by `app_metadata.role = design_partner`, posts to the `design-partner-submit` edge function, which stores to `design_partner_responses` and emails a PDF via Resend. 3) In-app Support ticket. There is no public contact form. |
| Bundle | One 1.0 MB JS chunk (313 KB gzip): ethers, Coinbase SDK and Supabase load on the landing page even for anonymous visitors. |

## Lighthouse baseline (production, mobile emulation)

| Performance | Accessibility | Best practices | SEO |
| --- | --- | --- | --- |
| 70 | 93 | 100 | 91 |

FCP 4.3 s, LCP 5.1 s, TBT 50 ms, CLS 0. The two causes are the Tailwind CDN runtime and the single 1 MB bundle.

Screenshots: `docs/rebrand/before/` (390 and 1440 px, light and dark scheme; the site ignores the scheme, so both are dark).

## Keep

- Every sandbox function: auth, setup wizard, sessions, wallet connect, Sepolia send / swap, governance, evidence, billing, support. The platform is reskinned, not rebuilt.
- The Design Partner intake, its gate, its edge function and its email delivery, unchanged in behaviour.
- The research articles (`blog.jsx`) as the "Read the research" destination.
- Social links and the "Design Partner" entry in the footer.
- Purple as the brand anchor (now paired with white, per the new direction).

## Replace

- Logo, favicon, wordmark: new hand-drawn SVG system.
- Landing page: rebuilt around "decision assurance layer for agentic finance".
- Tailwind CDN: compiled at build time (same classes, no runtime script).
- Gradient text, fuchsia accents, orbiting atom, `[ BRACKET ]` labels and `SNAKE_CASE` buttons on the public site.
- Meta, OG, Twitter, favicon set, sitemap, robots.

## Risks and how they are handled

1. **Tailwind moved to build time.** The JIT only sees literal class names. One dynamic pattern exists (`text-${c.c}-400` in Governed Movement); it is safelisted.
2. **Splitting the bundle.** The public site will render without loading the platform. The platform loads on demand, and immediately when a Supabase session, invite token or recovery link is present, so returning users and email links behave as before.
3. **Public contact form.** It reuses the existing `design-partner-submit` pipeline (store + email to the team). That endpoint has no rate limit; spam control is an open question.
4. **Proof points cannot be verified from here.** The FSB, EY and EO 14412 figures are used exactly as supplied, with visible sources. The existing research article cites EO 14409 for the same deadline; this needs one answer.
5. **Light theme inside the platform.** The platform has hand-coded dark classes in about 2,700 lines. It keeps its dark (ink) theme with the new tokens; the public site supports both schemes.
6. **Deployment.** Preview only. `main` and production are not touched.
