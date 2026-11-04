# TRACE — repository instructions and work plan

Last updated: 2026-11-04

This file applies to the entire repository. Read it before making changes. It records the current implementation, the rules that must survive changes, and the remaining work. User instructions take precedence. Treat proposed features below as a roadmap, not as deployed functionality or authorization to deploy resources.

## 1. Required maintenance of this file

Update `AGENTS.md` in the same work session as every major change. A major change includes a feature, a workflow or data-model change, a security or persistence change, a matching algorithm change, a dependency/runtime change, an AWS resource/deployment change, or a consequential bug fix.

For each major change:

1. Update the affected current-state and file-map sections.
2. Update roadmap status and acceptance criteria. Mark a task done only when its criteria are verified.
3. Record validation actually performed, including failures or checks that could not run.
4. Add a dated entry to the major-change history: change, reason, verification, and remaining limitation.
5. Update `README.md`, `docs/aws-starter.md`, and `docs/architecture.md` when their instructions or claims are affected.
6. End the user-facing response with a concise outcome and next step. Mention that this file was updated when appropriate.

Keep this file useful for the next person: replace stale facts instead of only appending new ones. Do not add secrets, account identifiers, access tokens, private claim answers, or personal data to it. Do not change completed statuses merely because a plan was written.

## 2. Product and user preferences

TRACE is a lost-and-found application. Its intended workflow is:

`lost/found report → possible match → ownership claim → human review → recorded handoff`

- The user wants code correctness and consistency addressed before AWS deployment guidance.
- Give the user short, simple explanations. Keep detailed technical notes here and in `docs/`.
- AWS is the intended hosting/backend platform, with Free Tier eligibility and spending controls checked before provisioning.
- Matching should help people find candidates. A person decides ownership and records the return.
- The next implementation phase is the shared backend and real authentication. A static deployment alone does not complete that phase.

## 3. Current state — verified baseline

### Implemented locally

- React 18, TypeScript, Vite 6, React Router 7, Tailwind, Framer Motion.
- Report wizard, discovery filters, item details, QR links/scanner, claims, dashboard, admin review, browser notifications, and browser audit history.
- `src/lib/store.tsx` uses React context and `localStorage`; the keys are `trace_state_v1` and `trace_state_v1_user`.
- Demo login accepts an email without verification. `alex@example.com` uses seeded user `u_demo`; `admin@trace.app` uses seeded admin `u_admin`; other normalized emails receive distinct demo IDs.
- The dashboard computes matching suggestions for each active lost report owned by the current demo user.
- New claims are checked for sign-in, found-item eligibility, self-claiming, existing claims by that user, and an already approved claim.
- Claim updates check the demo admin role and allowable transitions. The current implementation prevents a second approval in a single browser's current state.
- Handoff recording requires an approved claim and a note of at least five trimmed characters. It marks the found item returned, records the claimant and note in audit history, notifies the claimant, and declines other pending/review claims on that item.
- Report dates are validated. Photos accept JPEG/PNG/WebP, at most four, with a 5,000,000-byte source limit per file. Images are resized to a maximum dimension of 1,024 pixels and converted to JPEG at quality 0.72; results over 700,000 data-URL characters are rejected.
- Invalid discovery date parameters are ignored. Discovery filters are derived from the URL, without a simulated loading delay.
- The report wizard requires explicit review submission; Continue prevents the browser's default action when the button changes into a submit button.
- The scanner accepts same-origin `/items/...` links for navigation.
- Homepage totals come from local demo data. The homepage matching illustration still has explicitly labeled sample scores.
- The homepage hero is a scroll-driven WebGL question mark (`src/components/home/hero3d/`) opening at 45 degrees, with a CSS SVG fallback and two desktop scroll chapters about ranked possible matches and human review. `AshLayer` samples the rendered text into canvas fragments and applies a reversible edge dissolve to all intro copy and both chapter messages; the final message remains visible at the full turn. Reduced-motion and mobile paths keep static readable copy. The site uses ink `#171926`, accent `#40506A`, light accent `#8F9DC0`, and pale background `#E7EAF3`; the navigation additionally uses dark-purple glass `#160D25` at the user's request. The hero uses a pale background and subtle circular search field; How It Works uses a pale surface, Smart Matching a light blue tint, and the final call to action a dark panel with inverse buttons.
- Routes load on demand. External Google Fonts requests were removed; system font fallbacks work offline.
- Desktop hero uses a 760vh section: 540vh of story travel and 120vh of final hold. Text alone uses bounded catch-up progress so rapid scrolling still shows the dissolve; the mark follows scroll directly with scene damping, completes its turn by 88% of story progress, stays fully opaque, and finishes centered inside the existing circle. The final copy is fully visible from 96% of text progress. A soft CSS shadow replaces the clipped WebGL contact-shadow plane. Ash samples are cached per layout and created on demand, capped at 2,200 particles per chapter; reading holds do not schedule particle draws.
- Navigation is a compact centered dark-purple glass panel with rounded active highlights for pages and visible homepage sections. TRACE is a separate home link on the left; Report an Item is a separate desktop action on the right. The bar contains Discover, How It Works, Matching, and sign-in/account access. Mobile has the same links in a disclosure menu, including Report, with Escape and focus return.

### Not implemented or not production guarantees

- No AWS infrastructure, API, database, real identity verification, shared sessions, or cross-device synchronization is implemented in this repository.
- Demo email separation is a UI/data-consistency feature, not authentication. Anyone can enter the demo admin email.
- All browser state, including roles, private details, claims, and audit history, can be inspected or changed locally.
- Client-side guards are not a security boundary and do not solve simultaneous requests from multiple devices.
- A localStorage write failure is reported, but an in-memory mutation is not rolled back. Do not claim successful durable storage based solely on a toast.
- Persisted-state validation currently checks the outer array structure and basic user fields, not every nested value.
- Matching has no trained ownership model, labeled evaluation dataset, image matching, or calibrated probability.
- Notifications are in-app records only. There is no email or SMS delivery.
- Lost and found reports do not yet have a durable confirmed-pair relationship. Returning a found item does not automatically close a corresponding lost report.
- Private details are currently collected on lost reports. The admin panel looks for reference details on the claimed found item; a complete evidence/reference workflow is still needed.

## 4. Repository map

| Path | Responsibility |
| --- | --- |
| `src/App.tsx` | Routes, page loading/transitions, global layout |
| `src/components/Navbar.tsx` | Floating glass navigation, separate brand/action, page/section selection, mobile disclosure |
| `src/lib/types.ts` | Item, claim, user, notification, audit types; category/location lists |
| `src/lib/store.tsx` | Demo identity, persistence, mutations, notifications, audit entries |
| `src/lib/schemas.ts` | Report, claim, and sign-in form validation |
| `src/lib/matching.ts` | Pure matching/ranking calculation |
| `src/lib/demoData.ts` | Seed records and sample accounts |
| `src/components/ReportForm.tsx` | Report steps, image processing, submission |
| `src/components/ClaimForm.tsx` | Ownership answers and claim submission |
| `src/components/AdminReviewPanel.tsx` | Review decisions, decision notes, handoff dialog |
| `src/pages/ClaimPage.tsx` | Claim eligibility and claimant progress |
| `src/pages/DashboardPage.tsx` | User reports, claims, grouped matches, notifications |
| `src/pages/DiscoverPage.tsx` | Validated URL filters and listing search |
| `src/pages/ItemDetailsPage.tsx` | Listing actions, images, timeline, QR navigation |
| `src/components/QRScanner.tsx` | Camera/scanner lifecycle |
| `src/components/home/` | Homepage content; keep demo claims accurate |
| `src/components/home/hero3d/` | Scroll-driven WebGL hero (R3F), pure timeline sampler, welded mark geometry, WebGL fallback gate |
| `src/components/home/AshLayer.tsx` | Reversible scroll-linked text mask and glyph-sampled canvas fragments for all hero copy |
| `src/components/home/useHeroProgress.ts` | Shared text phase ranges and demand-driven bounded catch-up for ash transitions |
| `tailwind.config.js` | Shared four-color theme tokens (`accent`, `accentMid`, `accentLight`, ink/paper/mist/line/muted) |
| `docs/hero-experience.md` | Hero storyboard, rendering and asset choices, fallback behavior, validation and limits |
| `scripts/matching-test.mjs` | Matching behavior tests using Node's test runner |
| `scripts/consistency-test.mjs` | Playwright browser workflow checks |
| `docs/aws-starter.md` | Small, staged AWS rollout guide |
| `docs/aws-services.md` | First-version AWS inventory, purposes, request flow, cost assumptions, and deferred services |
| `docs/architecture.md` | Proposed larger AWS architecture; not deployed |

## 5. Rules for implementation

### Identity, privacy, and authorization

- Keep demo identity clearly labeled until Cognito is integrated. Remove the special admin-email shortcut from production mode.
- In the backend, derive user identity from a verified token. Never trust client-supplied owner IDs, reviewer identities, or roles.
- Public listing responses must exclude private identifying details, ownership answers, claimant contact information, and reviewer notes.
- Use separate public and restricted response types. Hiding a field in React is insufficient if it was already sent to the browser.
- Store private data and photos behind explicit access rules. Never put AWS credentials in frontend variables, the bundle, Git, or documentation.
- Preserve the human decision requirement. A match score must never approve a claim or mark an item returned.

### Workflow consistency

- Keep validation in the authoritative mutation layer as well as the UI. Once a backend exists, the backend becomes authoritative.
- No new claim on a returned item, no self-claim, and no duplicate claim by the same user under the current policy. Any retry/appeal policy must be designed explicitly.
- At most one approved claimant per found item. Enforce this atomically in the backend, including concurrent requests.
- A handoff must reference an approved claim and record the actor, recipient/claim, timestamp, and required note.
- Keep item status, claim status, timelines, notifications, and audit events consistent after every decision.
- Existing item status `claim_under_review` currently means approved and awaiting handoff in the UI. Rename it to an explicit status such as `awaiting_handoff` with a migration before treating the model as a stable API contract.
- Canceled decision/handoff dialogs must clear their notes so a later decision cannot inherit another record's text.
- Avoid broad resets of browser state. If persistence changes, add a deliberate version/migration path and explain limitations.

### Matching contract

- Only public title and description text may contribute to text similarity. Private answers and identifying details must not affect ranking or explanations.
- Current candidate filter: found reports in the same category, excluding returned items. Current maximum: three results per lost report.
- Current text processing: lowercase ASCII words, stop-word removal, basic plural normalization, doubled title tokens, smoothed TF-IDF and cosine similarity.
- Current score: `round(100 × (0.45 × textSimilarity + 0.30 + 0.15 × sameLocation + 0.10 × dateRelevance))`.
- `sameLocation` is exact trimmed, case-insensitive location equality; it is not geographic distance.
- `dateRelevance = 1 / (1 + absoluteDateDifferenceInDays / 7)`; invalid dates contribute zero. Results below 45 are omitted.
- These weights and the threshold are an initial heuristic, not validated accuracy. Display scores as ranking signals and explain supporting factors.
- Before changing weights or adding ML, use labeled lost/found pairs with negative examples and evaluate held-out ranking quality. Never invent an accuracy claim.
- Keep the calculation independent of React and browser APIs so the same logic can run in Lambda later.

### Code and UX

- Follow existing TypeScript/React conventions and reuse shared UI components.
- Keep changes scoped to the requested behavior; preserve user edits in the working tree.
- Prefer shared validation and clear domain functions over increasingly large UI event handlers.
- Preserve keyboard access, modal focus/escape behavior, meaningful form errors, mobile layout, and reduced-motion behavior.
- A report must stay on the review step until the user explicitly submits it.
- Do not add fabricated platform totals, fixed dashboard match scores, fake loading states, or claims of security that are not implemented.
- Keep dependencies locked. `dist/`, `node_modules/`, logs, local environment files, and build-info files are generated/ignored artifacts.
- Any dependency or runtime change must include the lockfile when affected and documented deployment compatibility.

## 6. Validation and local commands

The last verified runtime was Node 24.15.0. The matching test imports TypeScript directly through Node; do not assume older Node versions support that. Pin and verify the chosen Node version in local tooling and AWS build configuration before deployment.

PowerShell commands from the repository root:

```powershell
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1 --port 5173
npm.cmd run typecheck
npm.cmd run test:matching
npm.cmd run test:hero-timeline
npm.cmd run build
npm.cmd run preview -- --host 127.0.0.1 --port 4173
```

With the preview server running, use a second shell:

```powershell
npm.cmd run test:consistency
git diff --check
```

- The browser suite uses installed Google Chrome through Playwright. Its default URL is `http://localhost:4173`; override with `BASE_URL` when needed.
- `TEST_FILTER` selects checks by name for diagnosis. Some checks depend on earlier setup; a filtered run is not equivalent to the complete suite. Clear the variable before a full run.
- The browser suite fails on captured page/console errors. Investigate the cause instead of suppressing failures to obtain a green result.
- Vite scripts use `--configLoader runner` because the default config bundling encountered parent-directory access restrictions in this workspace. Revalidate when upgrading Vite.
- Run the build and relevant checks for behavior changes. Add regression coverage for significant failures. Documentation-only changes need content/link review and a whitespace check, not a full browser run.
- Stop temporary preview/test processes when finished unless the user wants them kept running.

Latest recorded verification, 2026-11-04: production build passed (HeroScene chunk ~895 kB is the known Three.js warning); eight hero-timeline tests and 32 browser checks passed during the glass navigation/final-hold pass. Desktop/tablet/mobile header screenshots and hero shadow/final-state screenshots were reviewed. Fast text catch-up, fixed stage placement through the end hold, section highlights, and mobile Escape/focus return were checked. The browser workflow suite ran before the last visual shadow/fallback adjustment. This is a historical result, not a claim that future edits are verified.

## 7. Ordered work remaining

Statuses: `DONE` means verified; `TODO` means unimplemented; `INVESTIGATE` means inspect/reproduce before choosing a fix. Work in this order unless the user changes priorities.

### A. Repository and demo handoff

- [DONE] Replace fixed dashboard suggestions with actual public-text ranking and explanations.
- [DONE] Separate demo accounts, guard claim decisions, require handoff notes, validate dates/photos, repair review-step submission, and update misleading demo copy/totals.
- [DONE] Add regression checks, split page bundles, and remove the external font dependency.
- [DONE] Refine the local homepage/header: compact glass navigation with page/section highlights, separate logo/report action, bounded text dissolve, opaque mark centered within its circle, and an end hold. Acceptance checked with desktop/mobile screenshots, section navigation checks, build, timeline tests, and the browser workflow suite. Real-device FPS remains unmeasured.
- [TODO] Repair Git origin and synchronize the changes with GitHub. Intended URL: `https://github.com/IvanUrbano/trace.git`.
  - Last observed origin was `C:/Users/iVAN/Desktop/TRACE_LOST_AND_FOUND/trace`.
  - This workspace was populated from that local checkout at commit `3d22805`; latest GitHub HEAD was not verified through a successful fetch.
  - `.git` writes and direct GitHub network access were restricted in the earlier environment. Recheck capabilities; do not treat these as permanent repository defects or bypass restrictions.
  - Acceptance: correct remote, successful fetch, upstream differences reviewed, local work preserved, and explicitly authorized changes pushed without force-overwriting remote work.
- [INVESTIGATE] Exercise corrupt nested storage records, storage exhaustion, legacy sessions created when all emails used `u_demo`, and reload behavior after failed persistence.
- [INVESTIGATE] Test closing the camera dialog during startup and navigating away while scanning; ensure no camera stream survives closure/unmount.
- [INVESTIGATE] Test submitting/navigating during image processing, multiple concurrent selections, unsupported browser image APIs, and small-screen forms.
- [TODO] Pin the supported Node version and automate build/typecheck/matching checks in CI. Add browser checks with a known Chrome/runtime setup.

### B. Define the backend contract before provisioning

- [TODO] Extract demo access behind a service interface so pages can use either demo or API data without duplicating business rules.
- [TODO] Define public/restricted types and validated request/response schemas. Keep storage types separate from API responses.
- [TODO] Resolve the report relationship and evidence workflow: which lost report a found report may match, what evidence the reviewer can access, and how both reports are closed after a return.
- [TODO] Make status names explicit and version the migration from current browser records. Existing demo data should not be uploaded automatically.
- [TODO] Specify API errors for unauthorized, forbidden, not found, validation failure, conflict, and retryable service failure. UI success must follow confirmed persistence.

Proposed minimum API (design to confirm during implementation):

| Operation | Access and acceptance requirement |
| --- | --- |
| List/get public items | Public fields only; validated filters; cursor pagination |
| Create report | Verified user; server assigns owner and ID; validates input |
| Get my reports/matches | Verified user; only their report-specific data |
| Submit claim | Verified user; item eligibility and duplicate checks |
| Get my claims | Claimant only; reviewer access is separate |
| Review claim | Admin only; atomic decision and one approved claimant |
| Record handoff | Admin only; approved claim, note, atomic return/audit updates |
| Read notifications / mark read | Current user's records only |
| Request photo upload | Verified user; scoped object key, type/size limits, expiring permission |

Acceptance for B: typed contracts and domain tests exist, including two-user isolation and conflicting claim decisions. No private field is present in public response fixtures.

### C. Build the AWS backend

- [DONE] Document the first-version AWS service inventory and distinguish required services from optional expansions in `docs/aws-services.md`. This completes service planning only; no resources are deployed.
- [TODO] Check the actual account plan, remaining credits, expiry, region availability, and current service prices. Do not promise a zero bill from generic Free Tier limits.
- [TODO] Set budget notifications and usage/log retention limits before provisioning. Budget alerts are not a hard spending cap.
- [TODO] Add reproducible infrastructure configuration. Record chosen region and resource roles in project docs without credentials or private account data.
- [TODO] Integrate Cognito for verified sign-in and admin groups; remove demo login shortcuts from production mode. Never grant admin from an email entered in the UI.
- [TODO] Implement API Gateway HTTP API and Lambda, with token verification and resource-level authorization in handlers.
- [TODO] Model DynamoDB access patterns and indexes for public browsing, owner reports, item claims, review queue, and user notifications. Avoid whole-table scans as the normal query strategy.
- [TODO] Use conditional/transactional writes and idempotency for claim approval and handoff. Record audit events with server identity and time; restrict update/delete access.
- [TODO] Store photos in private S3 with constrained uploads, an authorized read strategy, and cleanup of abandoned uploads. Keep image data out of DynamoDB and localStorage in production.
- [TODO] Move ranking to the backend, bounded by candidate retrieval. Keep results advisory and exclude unavailable/fulfilled candidates according to the finalized status model.

Acceptance for C: two real accounts on separate browsers share reports but cannot read each other's restricted data; non-admin review requests are denied; concurrent approvals cannot produce two winners; retries do not duplicate handoffs; data survives reload/device changes; uploads obey access and size rules.

### D. Connect and deploy the frontend

- [TODO] Replace browser mutations with the API adapter; add real loading/error/retry states, disable repeated submissions, and handle token/session expiry.
- [TODO] Deploy through Amplify Hosting using the pinned runtime, `npm ci`, `npm run build`, and `dist` artifacts. Configure SPA rewrites and verify direct detail-page refreshes.
- [TODO] Configure environment-specific public settings, allowed origins, Cognito callbacks/logout URLs, and actual deployment QR origins.
- [TODO] Run the workflow checks against the deployed test environment using non-sensitive fixtures. Test mobile layout and camera permissions manually when automated coverage is insufficient.
- [TODO] Document rollback, backup/recovery decisions, logs, and a way to remove test resources. Add custom DNS, WAF, SES/email, or EventBridge only when needed and cost-reviewed.

Acceptance for D: build is reproducible from GitHub; deep links and login redirects work; the deployed workflow uses the backend; errors are actionable; no production mode uses demo admin login or browser storage as authoritative private data.

### E. Evaluate matching after functional data exists

- [TODO] Collect consented or synthetic labeled pairs representing both matches and difficult non-matches. Keep private proof out of the dataset.
- [TODO] Evaluate top-three retrieval quality and false suggestions on held-out pairs; compare against simple category/date/location filtering.
- [TODO] Investigate color/brand contradictions, broad categories, wording differences, non-English text, and temporal ordering. Change thresholds only with recorded evidence.
- [TODO] Consider text embeddings, image similarity, or a trained ranker only if evaluation shows useful improvement within the cost/runtime budget.

Acceptance for E: documented dataset source and split, reproducible evaluation, measured results with limits, and no claim that ranking proves ownership.

## 8. Major-change history

### 2026-11-04 — glass navigation and balanced header

Added compact centered dark-purple glass navigation with rounded active highlights, separate TRACE home link on the left, and Report action on the right. Added Matching as the fourth visual navigation item, linked to the matching section; both section links track their actual viewport position and use scroll margins. Mobile disclosure closes on selection and Escape with focus returned. An initial browser suite run passed 30/31: the fixed 800ms anchor assertion was too short for the expanded hero's smooth scroll. Replaced it with a bounded viewport wait and added a Matching active-state check. Final suite passed 32/32; desktop/tablet/mobile screenshots showed no overflow or header overlap, and Escape/focus behavior was checked.

### 2026-11-04 — sustained text dissolve, opaque mark, and final hold

Added a demand-driven text catch-up controller so rapid input does not instantly skip ash transitions. Kept the mark on direct scroll progress with its existing damping after the user found shared text damping too slow. The turn now ends early, centered in its original circle, at full opacity; final pointer offsets settle to zero. Widened camera framing and replaced a visibly clipped contact-shadow plane with a radial CSS oval. Reserved 120vh after the 540vh story for a final hold before the sticky section releases. Build passed with the known ~895 kB lazy 3D chunk warning; eight timeline tests passed, including opaque/centered ending coverage. Browser checks confirmed a fast-scroll text hold, identical stage placement across the final scroll buffer, readable final copy, and clean shadow edges. Full browser suite passed 32/32 before the final visual shadow/fallback adjustment; no workflow logic changed. Actual-device FPS remains unmeasured.

### 2026-11-04 — delayed ash fades and slower scroll pacing

Extended the desktop section to 640vh (540vh scroll travel), giving the question mark about 42% more scroll distance for its turn. Delayed the intro dissolve to 32–54%, the middle entry to 52–66%, its dissolve to 76–86%, and the final entry to 85–96%. This increases reading holds and slows each text transition in scroll distance. Production build passed with the existing large 3D chunk warning. Production-browser checks confirmed intact intro at 30%, both ash exit states, intact middle/final reading states, and restoration on reverse scroll, with no page errors. Mobile and reduced-motion behavior is unchanged.

### 2026-11-04 — slower hero and stronger, demand-rendered ash

Extended the desktop hero from 320vh to 480vh, increasing its scroll travel from 220vh to 380vh so rotation, reading holds, and text transitions take about 73% more scrolling. Increased fragment size, density, and contrast using the existing ink/slate palette. Glyph raster samples are cached during layout sampling; each chapter samples only at its first transition and reuses those points until layout changes. Idle chapters skip particle frames and clear their canvas once. Fixed the entering fragment direction so particles converge toward the text. Production build and seven hero timeline tests passed. Instrumented production-browser checks showed zero glyph reads/draws at idle startup, no added reads on reverse scrolling, no draws in reading holds, and visible particles for intro exit, middle entry/exit, and final entry. Desktop screenshots were reviewed; no page errors or overflow appeared, and reduced-motion mobile had zero canvases and no overflow. The existing 3D bundle warning remains; real-device frame rate was not measured.

### 2026-11-04 — text-derived ash across hero chapters

Replaced generic floating particles and opacity fades with glyph-sampled canvas fragments and a scroll-linked edge mask. The intro text, action labels, first chapter, and final chapter all use the same reversible treatment; particles converge when new copy enters. Adjusted the last handoff to avoid overlapping chapter headlines. Kept the 45-degree opening mark and the four-color palette. Production build, seven deterministic hero tests, and 31 browser workflow checks passed. Desktop scroll screenshots and reverse navigation showed the intended copy at each chapter; reduced-motion mobile showed plain text without canvases or horizontal overflow. The lazy HeroScene chunk still raises a size warning, and frame rate on real devices has not been measured.

### 2026-11-04 — 45-degree hero and ash text transition

Set the 3D mark's initial and final yaw to 45 degrees (one full turn apart) and matched the SVG fallback. Replaced a first attempt that scattered full-size letters with a reusable `AshLayer` that gently blurs and fades whole text groups while small fragments drift upward; applied it to the intro and both later chapter transitions. Text remains readable at rest, reverses with scroll, and the final chapter remains visible through the turn. Reduced-motion/mobile paths do not render particles. The production build and seven deterministic timeline tests passed. Browser screenshots at initial, dissolving, middle, final, and reverse positions were reviewed, with no page errors or horizontal overflow; reduced-motion mobile displayed static copy without a WebGL canvas. The existing lazy 3D chunk warning remains.

### 2026-11-04 — rollback of heavy color blocking

At the user's request, removed the full blue hero side panel and slate process-section fill and restored the lighter matching tint and transparent-at-top navigation. Preserved the four-color palette, question mark, circular search motif, slower scroll captions, and dark final call to action. The rollback restores the previous lighter visual balance. Production build and whitespace check were run after the change.

### 2026-11-04 — full-page four-color composition

Increased color variation using the four user-specified colors: the desktop hero now has a full-height muted-blue right stage, the process section is slate, and Smart Matching has a stronger blue tint. Kept the circular search motif as the 3D mark's focus. Adjusted small process labels to pale text and gave the fixed navigation a pale background to preserve contrast on the blue hero side. Calculated slate-on-blue-tint contrast at about 4.67:1 and pale-on-slate at 6.78:1. Production build passed with the known large lazy 3D chunk warning. Desktop and mobile screenshots of the hero, process, and matching sections showed no page errors or horizontal overflow; browser inspection after the final adjustment confirmed the pale navigation and labels on slate.

### 2026-11-04 — hero search motif and slower chapter pacing

Replaced the plain rectangle behind the question mark with a circular search field and dashed outer ring. Extended the desktop pinned scroll distance from 260vh to 320vh, widened the text crossfades, and held the final claim-review message through the mark's full turn. Replaced slogan-like chapter copy with direct workflow descriptions. Browser review at initial, middle, end, and reverse scroll positions confirmed the expected message visibility and no horizontal overflow or page errors. Mobile hero review also showed no overflow or page errors. The final production build and `git diff --check` passed with the existing large lazy 3D chunk warning.

### 2026-11-04 — stronger homepage color rhythm

Added a restrained blue field behind the hero mark and an editorial highlight behind the key headline word, tinted the Smart Matching section, and made the final call to action a dark panel with contrasting inverse buttons. Kept the four specified palette colors. Desktop/mobile hero and final CTA screenshots were reviewed; no page errors or horizontal overflow appeared. The production build passed with the known lazy 3D chunk warning. The mobile CTA hides its decorative watermark so it cannot interfere with the action buttons. No new dependency was added.

### 2026-11-04 — hero storytelling and mobile framing

Added two scroll-timed explanatory chapters to the desktop hero so the pinned middle section communicates advisory matching and human review instead of leaving empty space. Adjusted the mid-scroll camera position and target to keep the entire 3D mark in frame. Kept the existing pure timeline and Framer Motion progress owner rather than add a competing GSAP controller. Added `docs/hero-experience.md` with creative direction, storyboard, architecture, asset approach, and performance limits. Desktop screenshots at the chapter positions and a reduced-motion mobile screenshot were reviewed; forward and reverse chapter opacity returned to the expected states, with no browser errors. The production build passed with the known large lazy 3D chunk warning; seven timeline tests and `git diff --check` passed. The 31 browser consistency checks had passed immediately before the chapter and camera adjustments.

### 2026-11-04 — four-color website palette

Applied the user's four specified colors to shared UI tokens, hero SVG and WebGL colors, the dot grid, and favicon. Assigned `#171926` to main text/deep surfaces, `#40506A` to readable accents and secondary text, `#8F9DC0` to borders and on-dark highlights, and `#E7EAF3` to light surfaces. Slate text on pale surfaces has a calculated 6.78:1 contrast ratio; light accents on deep navy have 6.44:1. Fixed mobile overflow in the Smart Matching section by letting its grid and indicator content shrink. Production build passed with the known ~899 kB lazy HeroScene warning; seven timeline tests and all 31 browser consistency checks passed. Desktop and mobile hero screenshots showed the palette, no console errors, and no horizontal overflow after the fix. Mid-scroll screenshot showed the side view of the 3D mark.

### 2026-11-04 — Deep Navy palette

Replaced the orange accent system with the user-provided Deep Navy palette: `accent`/`ink` `#1C1C28`, `accentMid` `#4B5168` (hover), `accentLight` `#C5C9DB` (on dark), plus navy-tinted `mist`/`line`/`muted`. Updated Tailwind tokens, primary-button hover, 3D mark/ring/lights/shadows, CSS question-mark extrusion, hero dot grid, favicon, and architecture diagram. Removed all `#C2410C`/`#FB923C` references from source and the production bundle (verified by hash scan). Typecheck, build, matching (4), hero-timeline (7), and browser checks (31) passed. AGENTS/README color claims updated in the same pass.

### 2026-11-04 — scroll-driven WebGL hero and UI highlight pass

Added `three@0.170`, `@react-three/fiber@8.18`, `@react-three/drei@9.122` for a sticky 260vh hero: pure `sampleHeroFrame` timeline, welded question-mark geometry (no cap z-fighting), orbit ring, demand rendering, reduced-motion/WebGL fallback to the CSS mark. Added `scripts/hero-timeline-test.mjs` (`npm run test:hero-timeline`). Spread accent highlights across eyebrows, stats, matching bars, card links, nav/footer hovers, active filters, and selection color. Debug query flags were removed after verification. Known limitation: HeroScene bundle ~899 kB; reduced-motion path untested beyond the existing consistency check.

### 2026-11-04 — hero illustration and accent

Removed the hero's item photos and duplicate fixed match badge, angled the question mark to start at 30 degrees, and defined the orange accent color in the Tailwind theme. Applied the accent to primary buttons. A later typography and scroll-color change to the mark was reverted at the user's request, restoring the SVG mark. The production build and `git diff --check` passed after the restore. Browser layout was not manually reviewed.

### 2026-11-04 — orange accent contrast

Darkened the shared orange accent from `#FF4D2E` to `#C2410C` because orange text was difficult to read on white. Matched the question mark's extrusion face to the new accent. Calculated 5.18:1 contrast against white for both orange text and white text on orange buttons. Production build and whitespace check were run after the change. Browser layout was not manually reviewed.

### 2026-11-04 — demo correctness and matching pass

Implemented actual dashboard ranking, distinct demo user IDs, claim/handoff guards, handoff notes and competing-claim closure, report date/photo handling, invalid URL handling, safe QR navigation, truthful demo statistics/privacy copy, and route splitting. Fixed the wizard's premature-submit behavior. Added matching and browser regressions; build/typecheck, four matching tests, and 31 browser checks passed. Authentication, persistence, privacy, and audit enforcement remain browser-demo features; AWS backend work remains open.

### 2026-11-04 — repository instructions and roadmap

Created this file at the user's request, documented the verified state and limitations, and added explicit maintenance duties, acceptance criteria, and the ordered AWS work plan. Reviewed it against current source/scripts and checked patch whitespace. No AWS resources were provisioned and no application code changed in this documentation step.

### 2026-11-04 — first-version AWS service inventory

Added `docs/aws-services.md` with six application services, IAM/CloudWatch/Budgets support, the request flow, deferred services, cost assumptions, and backend-first implementation order. Aligned README and rollout guidance with this smaller plan; labeled the older diagram as an expanded reference and corrected its DNS/TLS and email-delivery explanations in the accompanying text. Reviewed official AWS documentation, local document links, and patch whitespace. Account eligibility, pricing estimate, infrastructure, and backend implementation remain TODO; no AWS resources or application code changed.
