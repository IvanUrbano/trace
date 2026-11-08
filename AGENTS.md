# TRACE — repository instructions and work plan

Last updated: 2026-11-08

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
- Current priority is local code reliability and a simple Mandaluyong Community Board (posts and announcements only). AWS comes afterward. Shared backend and real authentication remain necessary before real multi-user operation; a static deployment alone does not complete that phase.
- Mandaluyong is the initial community demo setting. No real city/office partnership or physical custody is implied. Office intake, staff scope, disputes, and authority referral policies are design work, not implemented operations.
- The user selected PostgreSQL instead of the earlier DynamoDB plan. For deployment the user selected one small EC2 instance running the API and PostgreSQL (Docker Compose with Caddy HTTPS) instead of API Gateway/Lambda plus RDS. One `t3.micro` AL2023 instance is running in `ap-southeast-1` with Elastic IP `54.254.106.234`, Docker Compose stack (PostgreSQL 18, API, migration, Caddy), S3 bucket `trace-photos-ivan-020603` with public-read policy and CORS, and IAM role `instanceRole` attached to the instance. The instance is a single point of failure and needs manual patching and backups.

## 3. Current state — verified baseline

### Implemented locally

- React 18, TypeScript, Vite 6, React Router 7, Tailwind, Framer Motion.
- Report wizard, discovery filters, item details, QR links/scanner, claims, dashboard, admin review, browser notifications, and browser audit history.
- `src/lib/store.tsx` uses React context and `localStorage`; the keys are `trace_state_v2` and `trace_state_v2_user`, with a fallback load that migrates `trace_state_v1` records (including the `claim_under_review` → `awaiting_handoff` status rename).
- Report, claim, review, handoff, and notification mutations save the next snapshot before changing memory or reporting success. Failed writes leave the old state intact and allow retry; a ref prevents consecutive same-render mutations from using a stale snapshot. Invalid nested saved records show sample data with writes blocked and preserve the raw payload. Loading alone never rewrites the snapshot. Legacy sessions with an unexpected shared ID require sign-in again; sign-out writes a null marker to prevent v1 session resurrection.
- A read-write API adapter now exists for report creation: `src/lib/api/client.ts` (auth-gated fetch, bearer token from the Cognito session, error mapping) submits `POST /api/reports` when `VITE_API_BASE_URL` is set; photos are processed locally for preview but not yet saved with cloud reports. `src/lib/api/publicItems.ts` serves read-only public listings with the browser demo as fallback. All other mutations (claims, review, handoff) remain browser-demo only until their adapters are connected.
- `/community` is a Mandaluyong Community Board demo with member updates/tips, admin-only announcements, text search/category filters, and author/admin soft removal after confirmation. Posts use separate versioned `trace_community_v1` storage, save before success, and preserve the draft on write failure. There are no seeded engagement counts, comments, votes, or official notices. Posts do not create claims or influence item matching.
- `src/lib/contract/` defines the shared API contract: statuses, the six-code error model, public/restricted DTO schemas, and request/response schemas. `src/lib/service/domain.ts` is the authoritative mutation layer (identity from actor, claim/handoff rules, notifications/audit, v1→v2 migration); `src/lib/service/types.ts` declares the async `TraceService` interface for the future API. The store is the synchronous demo adapter over the same operations.
- A separate local PostgreSQL foundation now exists: `backend/postgres/001_initial.sql`, `backend/postgres/repository.mjs`, `scripts/postgres-migrate.mjs`, and `scripts/postgres-test.mjs`. It includes relational reports/private details, claims/answers, handoffs, audit, notifications, community posts, a restricted-field-free public view, partial unique indexes, serializable transactional claim/review/handoff operations, and handoff idempotency. Bounded matching retrieves at most 200 recent same-category found reports in the lost report's community and applies the existing heuristic to public fields. The repository is server-only and expects an actor ID supplied by a verified session. No browser data is imported automatically.
- A local HTTP API now exists in `backend/api/` and runs on EC2 at `https://54.254.106.234.sslip.io`: `jwt.mjs` verifies Cognito access or ID tokens against the pool JWKS with `jose` (issuer, audience, RS256), `app.mjs` holds the route table, bearer authentication, shared Zod request validation, DTO mapping, contract error/HTTP mapping, origin-allowlisted CORS, and a 256 KB body cap, and `server.mjs` wraps Node `http` with graceful shutdown. `PostgresRepository.ensureCommunity` and `ensureUser` map a verified issuer/subject to one local user and a membership; the Cognito `admin` group maps to the `admin` role and never downgrades an existing admin. `scripts/api-test.mjs` covers 16 handler cases with a fake repository and verifier. Routes: `GET /health`, `GET /api/items` (validated discovery filters), `GET /api/items/:id`, `POST /api/reports`, `GET /api/me/reports|claims|matches|notifications`, `POST /api/me/notifications/read`, `POST /api/claims`, `GET /api/admin/review-queue`, `GET /api/admin/claims/:id/evidence`, `POST /api/admin/claims/:id/review`, `POST /api/admin/handoffs` (UUID `Idempotency-Key` required). The React app calls `GET /api/items` for Discover/item details and `POST /api/reports` for new reports when `VITE_API_BASE_URL` is set; remaining mutations stay browser-demo only.
- `deploy/ec2/` holds the deployed single-instance deployment for the chosen EC2 design: `Dockerfile` (Node 24 API image), `docker-compose.yml` (PostgreSQL 18 volume, one-shot migration, API healthcheck, Caddy), `Caddyfile` (automatic HTTPS), `setup.sh` (Docker/Compose/swap on AL2023), and `.env.example`. Root `.dockerignore` keeps the image small. The stack is running on a `t3.micro` in `ap-southeast-1` with Elastic IP `54.254.106.234`; Docker was not installed on the development machine, so the image and compose file were verified by running them on the instance.
- An Amazon Cognito user directory has been manually created in Asia Pacific (Singapore), `ap-southeast-1`, for controlled TRACE testing. It has an `admin` reviewer group and one controlled test user in that group. The React app includes an environment-gated OIDC authorization-code/PKCE session using `react-oidc-context`. Navigation reflects Sign In / My Account / Sign Out; login returns to a validated local destination, and logout clears the local OIDC user then redirects through managed login. Public browsing remains available. In Cognito mode, old demo identities are ignored, report/claim/dashboard/admin routes require sign-in then show an unavailable-online notice, and community is read-only. Cognito groups never grant demo admin privileges. No API Gateway or Lambda integration exists. Resource identifiers remain in ignored local settings. Actual AWS login/logout and allowed sign-out URLs still need verification.
- `docs/aws-deployment-inventory.md` records the provisioned Cognito configuration, non-sensitive operational decisions, and the remaining integration work. Update it when an AWS resource or material cloud configuration changes.
- Item status `claim_under_review` was renamed to `awaiting_handoff` (approved, awaiting handoff recording).
- Demo login accepts an email without verification. `alex@example.com` uses seeded user `u_demo`; `admin@trace.app` uses seeded admin `u_admin`; other normalized emails receive distinct demo IDs.
- The dashboard computes matching suggestions for each active lost report owned by the current demo user.
- New claims are checked for sign-in, found-item eligibility, self-claiming, existing claims by that user, and an already approved claim.
- Claim updates check the demo admin role and allowable transitions. The current implementation prevents a second approval in a single browser's current state.
- Administrators cannot review their own claims. A linked lost report must be active and owned by the claimant; approval and handoff recheck it and prevent another approved claim from using the same lost report within the demo state. Claim statements and ownership answers reject whitespace-only input.
- Handoff recording requires an approved claim and a note of at least five trimmed characters. It marks the found item returned, records the claimant and note in audit history, notifies the claimant, and declines other pending/review claims on that item.
- Claimants can optionally link an active lost report when claiming a found item. Both report types can carry optional private reference details; the demo reviewer can compare the finder's reference and the claimant's linked report details. Handoff closes the linked lost report and other pending claims using it, notifying claimants and reopening alternate found items that have no remaining open claims.
- Report dates are validated. Photos accept JPEG/PNG/WebP, at most four, with a 5,000,000-byte source limit per file. Images are resized to a maximum dimension of 1,024 pixels and converted to JPEG at quality 0.72; results over 700,000 data-URL characters are rejected.
- Photo processing locks Continue/Submit, removal, and further file batches until complete. The form ignores results after unmount and supports an image-element decoder when `createImageBitmap` is absent. Submitting before the review step is guarded. Reports without photos show a neutral placeholder instead of unrelated stock imagery.
- Invalid discovery date parameters are ignored. Discovery filters are derived from the URL, without a simulated loading delay.
- The report wizard requires explicit review submission; Continue prevents the browser's default action when the button changes into a submit button.
- The scanner accepts same-origin `/items/...` links for navigation.
- Homepage totals come from local demo data. The homepage matching illustration still has explicitly labeled sample scores.
- The homepage hero is a scroll-driven WebGL question mark (`src/components/home/hero3d/`) opening at 45 degrees, with a CSS SVG fallback and two desktop scroll chapters about ranked possible matches and human review. `AshLayer` samples the rendered text into canvas fragments and applies a reversible edge dissolve to all intro copy and both chapter messages; the final message remains visible at the full turn. Reduced-motion and mobile paths keep static readable copy. The site uses ink `#171926`, accent `#40506A`, light accent `#8F9DC0`, and pale background `#E7EAF3`; the navigation additionally uses dark-purple glass `#160D25` at the user's request. The hero uses a pale background and subtle circular search field; How It Works uses a pale surface, Smart Matching a light blue tint, and the final call to action a dark panel with inverse buttons.
- Routes load on demand. External Google Fonts requests were removed; system font fallbacks work offline.
- Desktop hero uses an 895vh section: 675vh of story travel and 120vh of final hold. The 25% longer story travel reduces scroll sensitivity while text and mark continue to share direct story scroll progress. Each text fade additionally spans 25% more story progress. The mark retains scene damping, completes its turn by 88%, stays opaque, and ends centered. Final copy is fully visible at the start of the final hold. Ash samples are prepared during idle time per layout, capped at 1,200 particles per chapter and DPR 1.5; cached width removes per-particle layout reads. Reading holds do not schedule particle draws. Fast jumps may skip intermediate ash frames; real-device FPS remains unmeasured.
- The desktop WebGL mark uses a CSS-composited 16px/3.2-second idle bounce that runs whenever scrolling has settled anywhere in the hero, including the top and the final hold, and pauses while scroll is moving (300ms settle delay). The bounce moves the whole hero canvas, so the dashed orbit ring bobs with the mark; an in-scene mark-only bob that kept the ring still was tried and reverted because it required a throttled Three.js render loop while at rest. Reduced-motion, mobile, and SVG fallback remain still. CSS composition avoids a continuous Three.js render loop for the idle effect.
- Navigation is a compact centered dark-purple glass panel with rounded active highlights for pages and visible homepage sections. TRACE is a separate home link on the left; Report an Item is a separate desktop action on the right. The bar contains Discover, How It Works, Matching, and sign-in/account access. Mobile has the same links in a disclosure menu, including Report, with Escape and focus return. A slow violet passing light (`nav-sheen`, 6-second cycle, 4.5-second sweep) is clipped inside the glass panel and stays static under reduced motion.
- Navigation now also links to Community and has a thin gradient divider underneath. Below 1,280px it uses the disclosure menu to accommodate account and sign-out actions. The later hero chapters remain open on the hero background with small outline icons, short hairlines, chapter numbers, and minimal supporting strokes. The user rejected card backgrounds; do not restore them. Both chapters retain existing ash timings and mark motion without continuous extra animation. The CTA watermark's static wrapper owns translation at 46% horizontal position while its inner span owns entrance scale/opacity, keeping the final E in view.

Hero refinement (2026-11-07): glyph dust has roughly 15–20% farther drift/lift, a 12px scroll-driven curl, and a 50% longer normal particle travel window with softer opacity. Right-edge particles finish by the chapter boundary. Canvas padding is 200px; chapter timings, mark motion, 1,200-particle cap, and DPR cap are retained. At the user's request, a bounded time-based breeze keeps dust moving when scrolling pauses mid-fade. Text fading still follows scroll. Reading holds, completed transitions, hidden tabs, and unmount stop the animation loop; reduced-motion/mobile remain static. This replaces the previous no-draw rule for paused transitions only.

Homepage surroundings (2026-11-07): hero, How It Works, and Smart Matching use static decorative search rings, dotted item-tag paths, margin labels, and small cross marks. `SurroundingDetails` is aria-hidden and pointer-transparent; mobile reduces this to faint cropped rings. No extra animation or external assets are used.

### Deployed static frontend (2026-11-08)

- AWS Amplify Hosting serves the production frontend at `https://main.d2oswv5myenb38.amplifyapp.com/` from branch `main` of `https://github.com/IvanUrbano/trace`. It builds with the repository `amplify.yml` (`npm ci`, `npm run build`, artifacts in `dist`). `.nvmrc` pins Node 24.15.0 and `package.json` declares `engines.node >=24 <25`; the Amplify build image is Amazon Linux 2023 default.
- The Cognito user-pool ID, app-client ID, and managed-login domain are configured as Amplify environment variables. These are public SPA values baked into the browser bundle, not secrets. Local values remain only in ignored `.env.local`.
- Verified after the first deploy: the root document and hashed JS/CSS assets return HTTP 200. The SPA rewrite rule (`</^[^.]+$|\\.(?!(css|gif|ico|jpg|jpeg|js|png|txt|svg|webp|woff|woff2|ttf|map|json|manifest|webmanifest)$)([^.]+$)/>` → `/index.html`, 200) is applied, and direct navigation to `/discover`, `/signin`, `/items/...`, and `/community` returns 200 with the app shell. Use escaped dots in the JSON source; an earlier unescaped-dot pattern also matched `/assets/*.js`, served HTML for module scripts (MIME error), and its stale edge cache entry required a redeploy to invalidate.
- The deployment is static only. There is no API, database, shared records, photo upload, or server-side authorization. In Cognito mode the deployed app still shows the unavailable-online notices for report/claim/dashboard/admin routes. The Amplify origin is registered in the Cognito app client's callback and sign-out URL allowlists, and a real sign-in and sign-out with the controlled test user completed on 2026-11-08.

### Deployed backend API (2026-11-08)

- One `t3.micro` Amazon Linux 2023 instance runs the `deploy/ec2/` Compose stack: PostgreSQL 18, a one-shot migration container, the Node 24 API, and Caddy for automatic HTTPS. The Elastic IP is `54.254.106.234`; the API is served at `https://54.254.106.234.sslip.io` with a Let's Encrypt certificate obtained through the Caddy HTTP-01 challenge. The security group allows SSH from the owner's IP only and 80/443 from the internet; opening 80 was required for certificate issuance.
- Verified 2026-11-08: `GET /health` returns `{"ok":true}`, `GET /api/items` returns seeded public reports, and `GET /api/me/reports` returns 401 `unauthorized` without a token. `scripts/seed-demo-reports.sql` inserts seven demo reports (five found, two lost) into the `Mandaluyong` community once; it does not create accounts, claims, or private data.
- The API verifies Cognito tokens against the real pool JWKS only when a bearer token is supplied; public listing routes need no token. Real-token verification, CORS from the Amplify origin, the write workflow, photo storage, and community posts remain unverified or unimplemented.


- The API and PostgreSQL now run on EC2 and public listing routes are live (verified 2026-11-08). SPA OIDC sign-in and sign-out work against the real Cognito pool from the deployed Amplify origin. Not yet implemented: real-token verification against the pool, any write workflow from the browser (report/claim/review/handoff), photo upload, community API, cross-device session handling, and admin screens in the deployed UI. `src/lib/api/publicItems.ts` can read live listings when `VITE_API_BASE_URL` is set, but the deployed bundle is not yet configured with it.- Demo email separation is a UI/data-consistency feature, not authentication. Anyone can enter the demo admin email.
- All browser state, including roles, private details, claims, and audit history, can be inspected or changed locally.
- Client-side guards are not a security boundary and do not solve simultaneous requests from multiple devices.
- localStorage remains browser-local and user-editable. Save-before-success does not provide cross-tab synchronization, simultaneous-browser conflict resolution, backups, or backend durability. Invalid nested records are preserved but have no repair/export UI yet. Persisted schemas validate shapes; date/reference consistency is not exhaustively reconciled. Items with unmigratable statuses still follow the existing drop policy.
- Community permissions are local demo rules, not a production security boundary. Removed post bodies remain in browser storage; production retention, moderation audit, reporting/appeals, pagination, and backend operations are not implemented.
- Matching has no trained ownership model, labeled evaluation dataset, image matching, or calibrated probability.
- Notifications are in-app records only. There is no email or SMS delivery.
- The optional report link and reviewer evidence work in the demo, but the browser sends/stores private data locally without a security boundary. Real identity, restricted API responses, concurrent writes, reviewer permissions, and dispute/appeal/custody policies remain unfinished.
- The demo exposes only one admin login. It cannot review its own claim; testing a separate reviewer currently requires domain fixtures until multiple real admin accounts exist.
- The high-severity Zod advisory [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) is resolved: `zod` is now 4.6.7 and `npm audit` reports zero vulnerabilities. `@hookform/resolvers` was upgraded to 7.x because the Zod-3-era 3.x resolver produced runtime `ZodError` page errors with Zod 4. The local API caps request bodies at 256 KB and bounds collection sizes before schema parsing. That cap is not a substitute for rate limiting, authentication hardening, or a reverse-proxy review in production.

## 4. Repository map

| Path | Responsibility |
| --- | --- |
| `amplify.yml` | Amplify Hosting build spec: `npm ci`, `npm run build`, `dist` artifacts |
| `.nvmrc` | Pinned Node 24.15.0 for local/CI/Amplify builds |
| `src/App.tsx` | Routes, page loading/transitions, global layout |
| `src/components/Navbar.tsx` | Floating glass navigation, separate brand/action, page/section selection, mobile disclosure |
| `src/lib/types.ts` | Item, claim, user, notification, audit types; category/location lists; re-exports contract statuses |
| `src/lib/contract/` | Shared API contract: statuses + legacy mapping, error model, public/restricted DTO schemas, request/response schemas |
| `src/lib/service/domain.ts` | Authoritative pure operations: claim/handoff/report rules, notifications/audit side effects, restricted reads, v1→v2 migration |
| `src/lib/service/types.ts` | `TraceService` async interface for the future API |
| `src/lib/cognito.tsx` | Environment-gated Cognito OIDC session, login return handling, managed-login logout; does not authorize demo mutations |
| `src/lib/authNavigation.ts` | Local return-destination allowlist and Cognito logout URL builder |
| `src/pages/AccountPage.tsx` | Account session display and cloud-route notices until authenticated APIs exist |
| `scripts/auth-navigation-test.mjs` | Return-destination and logout URL unit tests |
| `scripts/auth-browser-test.mjs` | Simulated OIDC browser flow, PKCE, session isolation, redirects, logout, expiry, responsive navigation |
| `backend/postgres/001_initial.sql` | Initial PostgreSQL schema, constraints, indexes, and public report view |
| `backend/postgres/repository.mjs` | Server-only PostgreSQL report/claim/review/handoff/notification operations, identity mapping, and discovery filters |
| `backend/api/jwt.mjs` | Cognito JWKS token verification (issuer, audience, RS256) via `jose` |
| `backend/api/app.mjs` | HTTP route table, bearer auth, shared request validation, DTO mapping, error mapping, CORS, body cap |
| `backend/api/server.mjs` | Node HTTP wrapper, environment configuration, graceful shutdown |
| `scripts/api-test.mjs` | Handler tests with a fake repository and verifier |
| `deploy/ec2/` | Single-instance deployment: Dockerfile, Compose stack, Caddyfile, setup script, env example |
| `scripts/postgres-migrate.mjs` | Manually invoked, advisory-locked migration runner |
| `scripts/postgres-test.mjs` | Local isolated PostgreSQL integration, access, rollback, and concurrency tests |
| `scripts/seed-demo-reports.sql` | Idempotent demo community + seven public reports for the deployed API |
| `src/lib/api/publicItems.ts` | Env-gated read-only public listing adapter (Discover and item details) with local fallback |
| `docs/postgres-local.md` | PostgreSQL local setup, test safety, security limitations, and AWS follow-up |
| `src/lib/store.tsx` | Demo identity, persistence (`trace_state_v2`), synchronous adapter over the domain operations, toasts |
| `src/lib/persistence.ts` | Snapshot loading/save-before-success helpers, invalid-state protection, validated demo session loading |
| `src/lib/scannerSession.ts` | Cancelable scanner lifecycle across asynchronous import/startup/stop |
| `src/lib/community.ts` | Versioned community post schemas and actor-based create/remove rules |
| `src/pages/CommunityPage.tsx` | Mandaluyong local Community Board, composer, search/filter, confirmed removal |
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
| `src/components/home/SurroundingDetails.tsx` | Static SVG and margin decorations for hero, process, and matching sections |
| `src/components/home/ashTiming.ts` | Shared fade-edge and particle-phase calculations |
| `src/components/home/useHeroProgress.ts` | Shared text phase ranges; the former catch-up hook was removed so text follows direct scroll |
| `tailwind.config.js` | Shared four-color theme tokens (`accent`, `accentMid`, `accentLight`, ink/paper/mist/line/muted) |
| `docs/hero-experience.md` | Hero storyboard, rendering and asset choices, fallback behavior, validation and limits |
| `scripts/matching-test.mjs` | Matching behavior tests using Node's test runner |
| `scripts/contract-test.mjs` | Domain/contract tests: isolation, conflicting decisions, public-field privacy, migration |
| `scripts/consistency-test.mjs` | Playwright browser workflow checks |
| `scripts/reliability-test.mjs` | Storage/session, scanner cancellation, and community authorization regressions |
| `scripts/local-workflows-test.mjs` | Browser failure/retry, photo/camera lifecycle, community workflows, responsive screenshots in ignored `.local-checks/` |
| `docs/backend-contract.md` | Phase B decisions: operations, access rules, status model, evidence workflow, error model |
| `docs/aws-starter.md` | Small, staged AWS rollout guide |
| `docs/aws-services.md` | First-version AWS inventory, purposes, request flow, cost assumptions, and deferred services |
| `docs/aws-deployment-inventory.md` | Non-sensitive record of AWS resources actually created and their integration/cleanup status |
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
- Item status `claim_under_review` was renamed to `awaiting_handoff` with a v1→v2 storage migration; treat `awaiting_handoff` as the stable name in new code and contracts.
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
npm.cmd run test:contract
npm.cmd run test:reliability
npm.cmd run test:api
npm.cmd run test:hero-timeline
npm.cmd run build
npm.cmd run preview -- --host 127.0.0.1 --port 4173
```

With the preview server running, use a second shell:

```powershell
npm.cmd run test:consistency
npm.cmd run test:local-workflows
git diff --check
```

- The browser suite uses installed Google Chrome through Playwright. Its default URL is `http://localhost:4173`; override with `BASE_URL` when needed.
- `TEST_FILTER` selects checks by name for diagnosis. Some checks depend on earlier setup; a filtered run is not equivalent to the complete suite. Clear the variable before a full run.
- The browser suite fails on captured page/console errors. Investigate the cause instead of suppressing failures to obtain a green result.
- Vite scripts use `--configLoader runner` because the default config bundling encountered parent-directory access restrictions in this workspace. Revalidate when upgrading Vite.
- Run the build and relevant checks for behavior changes. Add regression coverage for significant failures. Documentation-only changes need content/link review and a whitespace check, not a full browser run.
- Stop temporary preview/test processes when finished unless the user wants them kept running.

Latest recorded verification, 2026-11-07: PostgreSQL 18.3 ran in an isolated local test cluster; migration applied successfully and repeat application was recognized, and PostgreSQL integration tests passed 8/8 including competing approvals, independent database constraints, scoped private evidence and community matching, rollback, linked return, and concurrent/idempotent handoff retries. Production build/typecheck, contract tests 21/21, reliability tests 11/11, matching 4/4, hero-timeline tests 9/9, and browser workflows 32/32 passed after adding `pg@8.16.3`. After adding the Cognito SPA boundary, typecheck and production build passed and the local `/signin` HTTP route returned 200; an actual Cognito redirect, invitation email, and signed-in browser session remain unverified. The targeted mobile linked-claim workflow and local workflows 11/11 passed earlier in this session. The 2026-11-07 animation pass (settle-anywhere CSS idle bounce and navbar violet passing light) passed typecheck, production build, a 6/6 idle-bounce browser check, a 6/6 sheen browser check, hero-timeline 10/10, consistency 32/32, and `git diff --check`; the Cognito-enabled local build was restored afterwards. `npm audit` reported the existing high-severity Zod advisory described above. PostgreSQL is not connected to the browser or a verified API. Actual-device camera behavior and FPS remain unmeasured.

Amplify/Zod update, 2026-11-08: typecheck and production build passed; matching 4/4, contract 21/21, reliability 11/11, hero-timeline 10/10, and consistency 32/32 passed after the Zod 4 and `@hookform/resolvers` 7 upgrades. `npm audit` reports zero vulnerabilities. The Amplify deployment was verified with HTTP requests: root document and hashed assets return 200 with correct MIME types (`text/javascript`, `text/css`), and `/discover`, `/signin`, `/items/...`, and `/community` return 200 after the SPA rewrite rule. An initial unescaped-dot rewrite pattern broke module-script loading (HTML served for `.js`); the escaped pattern plus a redeploy to invalidate the stale edge cache fixed it. A real sign-in with the controlled Cognito test user from the deployed origin succeeded on 2026-11-08 (the account needed a permanent password set through the Cognito admin API); sign-out was not exercised. `scripts/local-workflows-test.mjs` was not fully rerun: its fake-camera scanner check fails in this environment (the fake video track ends shortly after `getUserMedia` inside the html5-qrcode flow, with no `stop()` call observed), and the community layout check was corrected to the real 1,280px breakpoint.

## 7. Ordered work remaining

Auth verification update, 2026-11-08: build/typecheck, `node --test scripts/auth-navigation-test.mjs` (2/2), reliability (11/11), and `node scripts/auth-browser-test.mjs` passed. The browser suite uses a simulated OIDC provider against the configured dev server, without AWS credentials; desktop/mobile screenshots were inspected. `git diff --check` passed. Real invited-user AWS login/logout remains unverified. The broader suites recorded above were not rerun for this account-navigation change.

Local API update, 2026-11-08: added `backend/api/` and `scripts/api-test.mjs`. Verification: `test:api` 16/16, typecheck, production build, contract 21/21, reliability 11/11, and matching 4/4 passed. PostgreSQL 18.3 ran in an isolated local cluster on a non-default port; migration applied and the integration suite passed 9/9, including the new identity-mapping test (one user per issuer/subject, admin never downgraded, separate community membership). A live smoke run of `backend/api/server.mjs` against that database returned `/health` 200, an empty `/api/items` list, and 401 for missing and invalid tokens. `jose` was added for JWKS verification. Docker is not installed on this machine, so `deploy/ec2/Dockerfile`, `docker-compose.yml`, `Caddyfile`, and `setup.sh` have not been built or run; the Compose file and scripts are unverified. No AWS resource was created.

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
- [DONE] Guard corrupt nested storage records, failed writes, and ambiguous legacy sessions. Acceptance: malformed snapshots remain unchanged; unsuccessful mutations do not publish success or change memory; retry and reload retain one saved report; legacy sign-out cannot resurrect the v1 session. Schema/date/reference reconciliation and recovery/export UI remain follow-up work.
- [DONE] Repair camera closure during import/startup and SPA unmount. Unit and synthetic-camera browser checks verify eventual tracks stop and stale decode callbacks are ignored. The scanner keeps its imperative host attached offscreen until cleanup and waits for playback to settle. Actual-device permission dialogs and camera indicators remain a manual follow-up.
- [DONE] Guard submission/navigation during photo processing and prevent concurrent file batches. Acceptance: pending photos disable Continue/Submit and selection/removal; leaving does not publish a report; image-element fallback produces a JPEG when `createImageBitmap` is absent. Physical mobile browser APIs still need verification.
- [DONE] Add a local Mandaluyong Community Board with posts/announcements only. Acceptance: guest browsing, member posting, admin-only announcements, author/admin confirmed removal, search, reload, write-failure draft preservation, and desktop/tablet/mobile layout checks. No AWS/shared posts or official partnerships are implied.
- [DONE] Pin the supported Node version (`engines` + `.nvmrc`, Node 24.15.0) and add an `amplify.yml` build spec. Automating build/typecheck/matching checks in CI and browser checks with a known Chrome/runtime setup remain TODO.

### B. Define the backend contract before provisioning

- [TODO] Finish routing demo access through the async service interface so pages can switch adapters. `TraceService` is declared and domain rules are extracted/tested, but pages still use the synchronous store and dashboard matching directly.
- [DONE] Define public/restricted types and validated request/response schemas. Contract tests verify public-field privacy and two-user isolation; storage remains separate from public responses.
- [TODO] Finish the production report relationship and evidence workflow. The local demo supports optional claimant-owned active report links, finder/claimant references, self-review denial, one approved claim per linked lost report, and closure of linked reports and competing claims. Backend atomic enforcement, reviewer access, custody, disputes, and appeals remain to be designed and verified with real accounts.
- [DONE] Make status names explicit and version the v1→v2 browser migration. Existing demo data must not be uploaded automatically; migration tests pass.
- [DONE] Specify the six API error codes and HTTP mappings. Contract tests pass; local demo success now follows confirmed storage. Server persistence confirmation remains part of backend acceptance.
- [DONE] Add a local PostgreSQL migration and server-only transactional repository foundation. Acceptance: a dedicated PostgreSQL test database verifies public-field separation, reviewer/community scope, rollback, one approved claim per found/lost report, and idempotent concurrent handoffs. This does not complete HTTP/API/auth integration or production database privileges.
- [DONE] Upgrade Zod to 4.6.7 (with `@hookform/resolvers` 7.x) and rerun dependency security checks: `npm audit` reports zero vulnerabilities.
- [DONE] Add the local authenticated HTTP API over the repository. Acceptance: bearer-token verification with issuer/audience/RS256, identity and role derived server-side, shared request schemas, public DTOs with no private fields, contract error/status mapping, CORS allowlist, 256 KB body cap, UUID handoff idempotency, and handler tests with a fake repository. 16 handler tests and a live local smoke run pass. The verifier has not run against the real Cognito pool and the frontend does not call the API.

Proposed minimum API (implemented locally in `backend/api/`; cursor pagination and photo upload remain):

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
- [DONE] Complete the account cost review for the chosen EC2 design: the account owner confirmed a Free plan, remaining credits/expiry, and Singapore region selection on 2026-11-07. EC2, EBS, Elastic IP, and data-transfer costs under that plan were checked against the account plan before provisioning. Do not promise a zero bill from generic Free Tier limits.
- [DONE] Set budget notifications and usage/log retention limits before provisioning. Budget alerts are not a hard spending cap.
- [DONE] Add reproducible infrastructure configuration. The Compose stack in `deploy/ec2/` is the deployment definition and has been built and run on the instance (`docker compose up -d --build`); Dockerfile, docker-compose.yml, Caddyfile, setup.sh, and `.env.example` are committed. There is no separate IaC for the instance, security group, Elastic IP, or DNS; record chosen region and resource roles in project docs without credentials or private account data.
- [DONE] Connect SPA navigation and account access to the optional Cognito session. Acceptance: simulated browser checks verify PKCE, intended-page return, old demo-session isolation, logout, expired-session handling, and mobile/tablet navigation. Homepage/browsing remain public. Demo shortcuts are disabled in Cognito mode. This completion covers client behavior only.
- [TODO] Complete Cognito integration: real test-user sign-in and sign-out from the Amplify origin are verified (2026-11-08), but the API has not verified a real Cognito token and callback/logout allowlists for the future EC2 origin are not needed (the API is called with bearer tokens). Replace cloud-route unavailable notices only when authenticated API adapters exist. Never grant admin from an email entered in the UI.
- [DONE] Provision the EC2 backend: one `t3.micro` AL2023 instance, security group (SSH from owner IP, 80/443 public), Elastic IP, Docker Compose stack, Caddy HTTPS, and the migration container are running at `https://54.254.106.234.sslip.io`. This replaces the earlier API Gateway/Lambda/RDS plan.
- [DONE] Backups: daily `pg_dump` at 02:00 via cron, keeps last 7, script at `deploy/ec2/backup-db.sh`, installed by `setup.sh`; verified manually on 2026-11-08 (`trace-db-20261108-134957.sql`). Remaining DB ops still TODO: recovery drills, log retention, cursor pagination, index review.
- [DONE] Restrict database update/delete privileges and protect audit events from ordinary application roles. Created `trace_app` role with INSERT-only on `audit_events` (append-only, tamper-resistant); API container connects as `trace_app` via `DATABASE_URL` with `TRACE_APP_PASSWORD`. Claim/review/handoff writes remain transactional with server-derived actors and timestamps.
- [DONE] Store photos in private S3 with presigned PUT uploads. `POST /api/photos/presign` returns an object key, upload URL, and expiry; the frontend uploads directly to S3 and submits the object key with the report. Images are stored in `report_media` and served in public listings via `S3_PUBLIC_BASE_URL`. Requires an S3 bucket and an EC2 instance profile with S3 put/get permissions; abandoned-upload cleanup remains follow-up work.
- [DONE] Move ranking to the backend with bounded candidate retrieval. `GET /api/me/matches` returns the existing heuristic for the caller's own lost report; results stay advisory and exclude returned items. Thresholds and accuracy claims still require the evaluation work in section E.

Acceptance for C: two real accounts on separate browsers share reports but cannot read each other's restricted data; non-admin review requests are denied; concurrent approvals cannot produce two winners; retries do not duplicate handoffs; data survives reload/device changes; uploads obey access and size rules.

### D. Connect and deploy the frontend

- [DONE] Report creation now posts to the live API when the user is signed in through Cognito and `VITE_API_BASE_URL` is set; the bearer token comes from the OIDC session. Photos are uploaded to S3 via presigned PUT URLs and submitted with the report. Remaining mutations (claims, review, handoff) stay browser-demo only; loading/error/retry polish and token-expiry handling remain.
- [DONE] Deploy the static frontend through Amplify Hosting using the pinned runtime, `npm ci`, `npm run build`, and `dist` artifacts, with SPA rewrites and verified deep links. Deployment exists (2026-11-08, root/assets and SPA deep links return 200); the Amplify origin is registered in the Cognito callback/sign-out allowlists and a real test-user sign-in and sign-out succeeded. The API-backed workflow remains outstanding.
- [DONE] Configure environment-specific public settings, allowed origins, Cognito callbacks/logout URLs, and actual deployment QR origins. The Amplify origin is registered in the Cognito callback/sign-out allowlists.
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

### 2026-11-08 — live EC2 deployment complete and photo upload end-to-end verified

Provisioned EC2 backend is running at `https://54.254.106.234.sslip.io`: one `t3.micro` AL2023 instance with Docker Compose (PostgreSQL 18, Node 24 API, one-shot migration, Caddy HTTPS), Caddy obtained a Let's Encrypt certificate via HTTP-01, security group allows SSH from owner IP and public 80/443. S3 bucket `trace-photos-ivan-020603` has public-read GetObject policy and CORS allowing `PUT` from `https://main.d2oswv5myenb38.amplifyapp.com`. IAM role `instanceRole` is attached to EC2 `i-0eabc015420b989bf`. API container is healthy; `POST /api/photos/presign` returns 401 without a bearer token. End-to-end photo upload verified: signed in at the Amplify origin as `ivanurbano020603@gmail.com`, submitted a report with a photo, and confirmed the photo renders on the item page and in Discover. Verification: `GET /health` → `{"ok":true}`; presign without token → 401; report + photo submission → success. Daily `pg_dump` backup at 02:00 via cron, keeps last 7, script at `deploy/ec2/backup-db.sh`; verified manually (`trace-db-20261108-134957.sql`). Remaining: claims/review/handoff write adapters still browser-demo only, photo orphaned-upload cleanup, recovery drill, real two-account cross-browser isolation test.

### 2026-11-08 — automated daily database backups

Added `deploy/ec2/backup-db.sh` running `pg_dumpall` against the Docker PostgreSQL container daily at 02:00 via cron, retaining the last 7 backups. Updated `deploy/ec2/setup.sh` to install cronie, enable crond, and install the crontab entry. Verification: manual backup produced `trace-db-20261108-134957.sql` (34K), crontab entry confirmed under root, crond service running. Backup/restore drill not yet performed.

### 2026-11-08 — database least-privilege roles and append-only audit

Added `backend/postgres/002_db_roles.sql` creating a `trace_app` database role used by the API at runtime. `trace_app` gets SELECT/INSERT/UPDATE/DELETE on business tables but INSERT-only on `trace.audit_events` (append-only, tamper-resistant). Updated `deploy/ec2/docker-compose.yml` to connect the API as `trace_app` via `DATABASE_URL` with `TRACE_APP_PASSWORD`; added `TRACE_APP_PASSWORD` to the instance `.env`. Verification: API container healthy with `trace_app`, `GET /api/items` returns listings, `UPDATE trace.audit_events` rejected with `permission denied`. Remaining DB ops: recovery drills, log retention, cursor pagination, index review.

### 2026-11-08 — authenticated local API and EC2 deployment definition

Added `backend/api/` (`jwt.mjs`, `app.mjs`, `server.mjs`) as the local authenticated HTTP layer over `PostgresRepository`: Cognito access/ID token verification through the pool JWKS with `jose` (issuer, audience, RS256), server-derived identity and `admin` role, shared Zod request schemas, public/restricted DTO mapping, contract error-to-HTTP mapping, origin-allowlisted CORS, a 256 KB body cap, and UUID idempotency keys for handoffs. Extended the repository with `ensureCommunity` (advisory-lock select/insert) and `ensureUser` (one user per issuer/subject; admin membership never downgraded), discovery filters on public listing, and claimant/item names on claim reads. Added `deploy/ec2/` (Dockerfile, Docker Compose with PostgreSQL 18 + migration + API healthcheck + Caddy, Caddyfile, AL2023 setup script, env example) and a root `.dockerignore` for the chosen single-instance design, replacing the earlier API Gateway/Lambda/RDS plan. Added `test:api` and `api:start` scripts. Verification: `test:api` 16/16, typecheck, production build, contract 21/21, reliability 11/11, matching 4/4; PostgreSQL 18.3 in an isolated local cluster passed 9/9 including the new identity-mapping test; a live `server.mjs` smoke run returned `/health` 200, an empty `/api/items`, and 401 for missing/invalid tokens. Docker is not installed here, so the image, Compose stack, Caddyfile, and setup script are unverified; no AWS resource was created and the frontend still uses the browser demo store.

### 2026-11-08 — Amplify Hosting deployment and Zod 4 security upgrade

Deployed the static frontend through AWS Amplify Hosting from GitHub branch `main` at `https://main.d2oswv5myenb38.amplifyapp.com/`. Added `amplify.yml` (`npm ci`, `npm run build`, `dist` artifacts), `.nvmrc` (Node 24.15.0), and `engines.node >=24 <25`; the Cognito pool/client/domain values are set as Amplify environment variables (public SPA values). Upgraded `zod` 3.25.76 → 4.6.7 to resolve advisory GHSA-mrhx-c7xc-m3w5 (`npm audit`: zero vulnerabilities) and migrated deprecated calls (`z.email`, `z.uuid`, `z.iso.datetime`); `@hookform/resolvers` 3.x → 7.x was required because the old resolver threw runtime `ZodError` with Zod 4. Also fixed the local-workflows layout check to use the real 1,280px disclosure breakpoint. Verification: typecheck, production build, matching 4/4, contract 21/21, reliability 11/11, hero-timeline 10/10, consistency 32/32; deployed root and hashed assets return HTTP 200 with correct MIME types, and SPA deep links return 200 after the rewrite rule. An unescaped-dot rewrite pattern initially rewrote `/assets/*.js` to HTML; the escaped pattern plus a redeploy to clear the stale edge cache resolved it. The deployment is static only; the Amplify origin is registered in the Cognito callback/sign-out allowlists and a real test-user sign-in and sign-out succeeded on 2026-11-08. No API, database, or shared records exist.

### 2026-11-08 — report creation connected to the live API

Added `src/lib/api/client.ts` (auth-gated fetch, bearer token from the Cognito session, contract error mapping) and wired `POST /api/reports` into the report wizard when `VITE_API_BASE_URL` is set; photos are processed locally for preview but not yet saved with cloud reports. `VITE_API_BASE_URL` was added to the Amplify environment variables and the site redeployed through GitHub. The EC2 API enforces bearer auth: unauthenticated report creation returns 401 `unauthorized`. Verification: typecheck, production build, unauthenticated POST returns 401. Full sign-in → submit → live listing flow requires real Cognito credentials and remains a manual check.

### 2026-11-08 — photo uploads to S3

Added `POST /api/photos/presign` to the EC2 API (auth-gated, validates file type/size, returns an S3 presigned PUT URL, object key, and expiry). The report wizard now uploads each photo directly to S3 before submission and submits the object keys with the report. `createReport` stores object keys in `report_media`; public listings serve full S3 URLs via `S3_PUBLIC_BASE_URL`. Added `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` dependencies. Requires an S3 bucket and an EC2 instance profile with S3 put/get permissions, plus `S3_BUCKET`/`S3_REGION`/`S3_PUBLIC_BASE_URL` in the instance `.env`. Verification: typecheck, production build. Orphaned-upload cleanup remains follow-up work.

### 2026-11-08 — public landing page and Cognito account navigation

Kept the homepage public and connected Sign In / My Account / Sign Out to the OIDC session. Added validated return destinations, managed-login logout, account status, and sign-in gates for report/claim/dashboard/admin routes. Those routes explain that online operations remain unavailable until the API exists. Old demo sessions and demo sign-in shortcuts are ignored in Cognito mode; community remains read-only. The disclosure-menu breakpoint is now 1,280px to fit the account actions. Updated README and AWS inventory/starter/services/architecture docs. Verification: build/typecheck passed (existing large HeroScene warning), auth-navigation 2/2 and reliability 11/11 passed; simulated OIDC browser flow verified PKCE, intended-page return, logout, old-session isolation, invalid redirects, session expiry, and mobile/tablet layout. Desktop/mobile screenshots were inspected. The first browser run failed due to an ambiguous Sign In locator also matching the footer; scoping it to the header fixed the test, and subsequent runs passed. No cloud settings were changed. Real AWS invited-user login/logout and allowed sign-out URLs remain unverified; no authenticated API or shared persistence exists.

### 2026-11-07 — settle-anywhere hero bounce and navbar violet sheen

The desktop WebGL mark's CSS idle bounce now resumes whenever scrolling settles anywhere in the hero (previously top-only) and pauses while scroll moves, using a 300ms settle delay on both story and raw progress values. The floating glass navigation gained a slow violet passing light (`nav-sheen`, 6-second cycle, clipped inside the panel, static under reduced motion). An in-scene mark-only bob that kept the dashed orbit ring still was implemented and then reverted at the user's request because it required a throttled Three.js render loop while at rest; the bounce therefore moves the whole canvas, ring included. Verification: typecheck, production build, idle-bounce browser check 6/6, sheen browser check 6/6, hero-timeline 10/10, consistency 32/32, and `git diff --check` clean; the Cognito-enabled local build was restored afterwards. Real-device FPS remains unmeasured.

### 2026-11-07 — homepage surrounding details

Added a shared decorative component with cropped search rings, dotted item-tag routes, cross marks, and vertical Search/Connect/Return labels around three homepage sections. These fill empty margins using existing colors without enclosing hero chapters in cards. Decorations are static, aria-hidden, pointer-transparent, and clipped within their sections; mobile hides the labels, trails, and crosses. Build/typecheck passed with the known HeroScene size warning. Desktop/mobile production screenshots were inspected; browser checks passed for no horizontal overflow, three decorative layers, click-through styling, and no page errors. Reduced-motion screenshots confirm static decoration; no additional animation was introduced. README and hero notes updated. No AWS changes.

### 2026-11-07 — floating dust during paused fades

Added gentle time-based particle offsets during active fades so a pause in scrolling does not freeze the dust. The text mask and opacity remain scroll-controlled. A single frame loop per active canvas stops at reading holds, transition boundaries, hidden tabs, and unmount. Updated README and hero notes to replace the earlier paused-transition performance rule. Build/typecheck and ten hero timeline tests passed; the existing large HeroScene bundle warning remains. Production-browser checks confirmed changing particle images with a fixed text mask during paused intro/matching exits and both entrances, reverse scrolling, no draws at the matching reading hold or story endpoints, static mobile/reduced-motion fallbacks, and no page errors. Hidden-tab/unmount cleanup was inspected in code, not simulated in this browser check. Real-device FPS remains unmeasured.

### 2026-11-07 — gentler glyph dust travel

Lengthened particle travel from 0.28 to 0.42 of the mask-edge range, increased drift/lift modestly, and added a small reversible sideways curl plus a softer opacity envelope. Rightmost glyphs use a bounded window to settle before the chapter ends. This addresses rushed dust without changing chapter durations or the direct scroll relationship. Updated the hero notes and README. Build/typecheck passed with the existing large HeroScene warning; hero tests passed 10/10. The first new boundary assertion failed only on floating-point roundoff and was corrected to use a tolerance. Production-browser checks verified particles during intro/matching exits and both entrances, reverse scrolling, cleared canvases at the endpoints, zero idle draws, mobile/reduced-motion fallbacks, and no page errors. Desktop screenshots were visually inspected. Real-device FPS remains unmeasured; fast scroll jumps may still skip intermediate frames. No AWS changes.

### 2026-11-07 — Cognito-aware SPA sign-in boundary

Added `oidc-client-ts` and `react-oidc-context` and an environment-gated OIDC authorization-code provider for the React SPA. When `VITE_COGNITO_USER_POOL_ID` and `VITE_COGNITO_CLIENT_ID` are supplied only through ignored local environment settings, `/signin` redirects to Cognito and returns to the app with a verified OIDC session. The sign-in screen clearly states that the local browser demo remains authoritative until a verified API is implemented; it does not map Cognito groups to local admin privileges or pass tokens to a backend. Added `.env.example` with placeholders only. Typecheck and production build passed; the existing large HeroScene chunk warning remains. `npm install` continued to report the pre-existing high-severity Zod advisory, which must be resolved before an untrusted HTTP API is exposed.

### 2026-11-07 — Cognito directory provisioned for controlled testing

The account owner selected Asia Pacific (Singapore), `ap-southeast-1`, as TRACE's default Region, checked the account's Free plan credits and expiry in AWS Billing, and manually created a Cognito user directory with an `admin` group and one controlled test user in that group. This is the first known AWS resource for TRACE. It has no application integration, production callback, API, database, photo bucket, infrastructure-as-code definition, or end-to-end verification. No resource identifiers, account identifiers, credentials, or credit amounts were recorded in the repository. Documentation was updated to remove the inaccurate claim that no AWS resources exist; no application code or automated validation changed.

### 2026-11-05 — PostgreSQL local foundation

At the user's direction, selected PostgreSQL instead of the earlier DynamoDB proposal. Added a versioned SQL schema with public/private separation, membership-scoped reviewer checks, relational claim/recipient links, partial unique indexes for approved claims, and idempotent handoffs. Added a server-only `pg` repository using serializable transactions, a review queue, bounded public-field matching, migration, and isolated-database integration tests. PostgreSQL 18.3 test cluster was isolated from the existing service; migration applied and rerun safely, and eight real database integration tests passed including concurrent approvals and retries. Node 24.15.0 build/typecheck, 21 contract tests, and 11 reliability tests passed. `npm audit` identified an existing high-severity Zod 3 advisory; do not expose an API until its compatible upgrade and request limits are addressed. The repository is not an HTTP API and the frontend still uses localStorage; authentication, database roles, production credentials/TLS/backups, remaining operations, API adapter, and AWS provisioning are outstanding. Updated README and AWS/architecture docs; the old diagram's DynamoDB labels are explicitly marked outdated.

### 2026-11-05 — linked claims, evidence, and reviewer conflicts

Added optional active lost-report selection to the claim form and private finder references to found reports, allowing the demo reviewer to compare finder and linked claimant details. Domain rules reject self-review, invalid/stale linked reports, and conflicting approvals for the same lost report. Handoff closes other pending claims using the returned lost report, notifies claimants, and restores alternate found items without other open claims. Claim fields reject whitespace-only answers, and claim dialogs scroll within small screens. Contract tests passed 21/21, matching 4/4, reliability 11/11, existing browser workflows 32/32, and a targeted mobile browser workflow verified evidence, review, and closure of both reports. Build/typecheck passed with the known 3D chunk warning. Browser-local permissions and writes are not secure or cross-device atomic; only one demo admin exists, and AWS/backend implementation remains outstanding.

### 2026-11-05 — lower-sensitivity text fades

Widened each text-fade range by 25% of its previous story-progress span so it takes more scrolling, while preserving direct scroll response, synchronized particles, a matching reading hold, and the final 120vh hold. Shifted the intro exit and chapter transition positions to fit the longer fades; final copy finishes at the beginning of the final hold. Production build and nine hero timeline tests passed. Production-browser checks confirmed particles during both transitions, forward/reverse behavior, final hold, idle bounce, and reduced-motion/mobile behavior. Real-device FPS remains unmeasured.

### 2026-11-05 — reduced hero scroll sensitivity

Increased desktop story travel from 540vh to 675vh (25%) for a less sensitive scroll response. The section is now 895vh including the unchanged 120vh final hold and viewport height. Text, particles, and mark continue to use direct synchronized progress. Production build, nine timeline tests, 32 browser workflow checks, and production-browser forward/reverse/hold and reduced-motion checks passed. Real-device FPS remains unmeasured.

### 2026-11-05 — restored original hero scroll distance

Restored 540vh of story travel and the 120vh final hold (760vh section) at the user's request. Kept direct scroll synchronization, idle glyph sampling, reduced particle/DPR limits, and the top-of-page mark bounce. Synchronized particles with the same eased mask edge and vertical text offset after the user observed late scattering in chapters two and three. Production build and nine timeline tests passed; browser screenshots showed visible particles during matching and review fades and confirmed reverse scrolling, bounce, reduced motion, and mobile behavior. Fast scroll jumps can skip particle frames; real-device FPS remains unmeasured.

### 2026-11-05 — slower story fades and idle mark bounce

Extended story travel from 540vh to 810vh so fades and the mark's turn take 50% more scrolling without introducing delayed text catch-up; retained the 120vh final hold. Added a noticeable 16px, 3.2-second CSS-composited bounce to the desktop WebGL mark at the top; scroll progress stops it, and reduced motion, mobile and fallback remain static. Build and eight hero timeline tests passed. Browser checks measured at least 14px of bounce, confirmed it stops during scroll and stays still for reduced motion/mobile, and checked chapter sync and watermark bounds. Actual-device FPS remains unmeasured.

### 2026-11-05 — lighter hero accents, synchronized fades, and full watermark

At the user's request, replaced the initial card-like chapter backgrounds with small outline icons, hairlines, chapter numbers, and minimal supporting strokes. Added a thin navbar divider. Corrected the CTA watermark's conflicting CSS/Framer transforms and positioned it slightly left so all of TRACE is visible. Removed the artificial text catch-up loop: chapter masks now use the same direct story progress as the mark. Moved glyph sampling into idle time, reduced the particle cap from 2,200 to 1,200 and canvas DPR to 1.5, and cached width outside the particle loop. Build and eight timeline tests passed; screenshots and direct/reverse scroll checks verified chapter readability, mobile fallback, and full watermark bounds. Final 32 browser workflow checks passed. Fast jumps may skip intermediate ash frames; real-device FPS remains unmeasured.

### 2026-11-05 — local reliability and Mandaluyong Community Board

Implemented save-before-success for demo mutations, deep structural validation of saved records, preserved corrupt payloads with writes blocked, validated legacy sessions, and prevented old sessions reappearing after sign-out. Photo processing now blocks navigation/submission within the wizard, ignores late unmounted results, supports a decoder fallback, and uses honest empty-photo placeholders. Scanner teardown handles pending imports/permission/startup and unmount; browser tests found a media-playback race that required waiting for playback and retaining the imperative host until shutdown. Added a local Community Board with member posts, admin announcements, search/filter, author/admin soft removal, and storage-failure draft preservation. User confirmed posts and announcements only. Navigation includes Community; tablet disclosure and mobile toast width avoid crowding/clipping. Build/typecheck, 39 unit/domain/timeline checks, 32 existing browser checks, and 11 new local browser checks passed. README/backend/AWS notes updated. No AWS resources, real authentication, official office integration, comments, or shared community persistence were added; actual-device camera verification remains open.

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
