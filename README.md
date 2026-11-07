# TRACE

A modern, minimalist lost & found platform built with React. Report lost belongings, discover found items, submit ownership claims, verify ownership, and track the safe return of property through one transparent workflow.

> Lost something? Let's bring it back.

Development instructions, current limitations, and the ordered implementation roadmap are maintained in [AGENTS.md](AGENTS.md). Update it with every major project change.

## Features

- **Editorial homepage** — scroll-driven 3D WebGL hero opening at 45 degrees, slower scroll pacing and visible text-derived ash across its story chapters, demand-rendered particles, CSS fallback, staggered entrance animations, recently found grid, four-step process timeline, smart matching preview, dark trust & verification section, functional QR section, and final CTA.
- **Discover** — search, category/location/date filters, lost/found toggle, sort by newest or relevance, URL-persisted filter params, skeleton loading and empty/error states.
- **Item details** — photo gallery, description, status timeline, live QR code for the listing, claim CTA. Private identifying details are never rendered publicly.
- **Report an item** — guided 3-step form (basics → details → review) with drag-and-drop photo upload and previews, inline validation, lost/found toggle.
- **Claim & verification** — ownership questions, an optional link to the claimant's active lost report, review progress, and manual comparison with finder-provided reference details. The demo keeps these fields in browser storage; it is not secure authentication or shared storage.
- **User dashboard** — lost reports, found reports, my claims, ranked possible matches, notifications, status history.
- **Admin dashboard** — pending claim review queue, approve/decline with notes, recorded handoff details, item reports table, browser audit history. Matching never auto-approves ownership.
- **Linked returns** — an approved handoff closes connected lost and found reports and competing pending claims for that lost report. An administrator cannot review their own claim; the demo currently has only one admin login.
- **Mandaluyong Community Board** — local demo posts, search/category filters, admin-only announcements, and author/admin post removal. No comments or votes yet; item reports and claims stay in their dedicated workflow. No government partnership is implied.
- **Microinteractions** — hover/focus/active states, toasts, modals with Escape + focus trap, animated status timelines, QR camera scanner gated behind explicit permission.
- **Motion** — Framer Motion fade-up reveals, staggered grids, image clip reveals, animated dividers and timeline connectors, subtle route transitions. All animations respect `prefers-reduced-motion`.

## Design system

The [hero experience notes](docs/hero-experience.md) describe its visual story, scroll timeline, rendering approach, and performance limits.

Later hero chapters use small outline icons, short hairlines, chapter numbers, and minimal supporting strokes on the open hero background, under the existing reversible ash treatment. Text follows scroll directly with reduced sensitivity. The desktop WebGL mark keeps a gentle CSS bounce that pauses while scrolling and resumes once scrolling settles anywhere in the hero; it stays still under reduced motion. A thin divider sits beneath navigation, and a slow violet light passes across its glass panel. The final CTA's oversized TRACE watermark sits slightly left with translation separated from its entrance scale so the E stays visible.

| Token | Value |
| --- | --- |
| Main text / deep background | `#171926` |
| Accent / secondary text | `#40506A` |
| Borders / on-dark accent | `#8F9DC0` |
| Light background | `#E7EAF3` |
| Type | System sans (Inter when installed) |
| Icons | Lucide React (monochrome line) |

Slate primary buttons with pale text, pale secondary buttons with navy borders, square/subtle corners, generous whitespace, and Swiss-editorial typography. A subtle circular field behind the hero mark, a lightly tinted matching section, and a dark final call to action use the four-color palette. The floating navigation adds translucent dark-purple glass with rounded blue active highlights; TRACE sits separately on the left and Report an Item on the right. Discover, How It Works, Matching, and sign-in/account links occupy the centered bar.

Hero dust drifts farther with a gentle sideways curl and a longer, softer particle fade. Dust continues floating when scrolling pauses during a fade; text fading follows scroll directly. Particle animation stops during reading holds and in hidden tabs.

Static search rings, dotted item-tag paths, cross marks, and margin labels give the hero, How It Works, and Smart Matching sections more surrounding detail. Mobile keeps only faint cropped rings; decorations do not block interaction.

## Architecture


The proposed AWS version uses Amplify Hosting for the frontend, Cognito for accounts, API Gateway HTTP API and Lambda for backend operations, **PostgreSQL** for records (Amazon RDS for PostgreSQL is a candidate), and private S3 for photos. IAM, CloudWatch, and AWS Budgets support permissions, monitoring, and cost alerts. A Cognito user directory has been manually created in Singapore. The SPA has an optional Cognito sign-in/account flow; the backend services remain undeployed.

A PostgreSQL migration and server-only repository are implemented and tested locally. They are not connected to the React app or an HTTP API; the current app still uses the browser demo store. See [local PostgreSQL setup](docs/postgres-local.md) for migration/testing and the remaining security work.

The [AWS deployment inventory](docs/aws-deployment-inventory.md) records the non-sensitive configuration and integration status of services actually created for TRACE.

For controlled Cognito sign-in testing, copy `.env.example` to an ignored `.env.local` and provide the user-pool, SPA client, domain, callback, and logout settings locally. Register `http://localhost:5173/` as both an allowed callback URL and allowed sign-out URL for local testing. Restart Vite after changing these settings.

The homepage and browsing remain public. In Cognito mode, navigation shows Sign In or My Account / Sign Out from the OIDC session, and login returns to the requested page. Old demo sessions are ignored. Reporting, claims, dashboard, and reviewer routes require sign-in and then explain that online operations are unavailable until the authenticated API exists; community browsing remains read-only. Without Cognito settings, the local demo workflow remains available. Never treat the demo as a production backend.

Auth validation: `node --test scripts/auth-navigation-test.mjs`; with the configured dev server running, `node scripts/auth-browser-test.mjs` exercises a simulated OIDC provider (no AWS credentials or real login). A real invited-user login/logout still needs manual verification.

See the [AWS service inventory](docs/aws-services.md) for each service's purpose, costs to check, request flow, and implementation order. The [expanded architecture](docs/architecture.md) is an optional alternative, not the first-version checklist.

## Tech stack

- React 18 + TypeScript + Vite
- Tailwind CSS
- Framer Motion
- React Router
- React Hook Form + Zod
- Lucide React
- Three.js + React Three Fiber + Drei (homepage 3D hero)
- `qrcode.react` (functional QR generation)
- `html5-qrcode` (camera scanning, permission-gated)

## Getting started

```bash
npm install
npm run dev
```

Build and preview:

```bash
npm run build
npm run preview
```

Checks: `npm run typecheck`, `npm run test:matching`, `npm run test:contract`, `npm run test:reliability`, `npm run test:hero-timeline`, `npm run test:consistency`, and `npm run test:local-workflows`. Both browser suites expect a preview server on port 4173; set `BASE_URL` for another port. Local workflow screenshots are generated in ignored `.local-checks/`.

For a staged AWS deployment, see [docs/aws-starter.md](docs/aws-starter.md).

## Demo accounts

- **User** — any email address (e.g. `alex@example.com`). Sample data is pre-seeded for `alex@example.com` including a pending claim and notifications.
- **Admin** — `admin@trace.app` opens the review queue and audit log at `/admin`.

Demo state is persisted to `localStorage`; clear site data to reset it. Browser storage is not secure shared storage and should not hold real private ownership details.

Reports, claims, decisions, handoffs, and notification changes are saved before the UI reports success. A failed save leaves the previous in-memory state intact and permits retry. Malformed nested saved records show a warning and sample data with writes blocked; the original saved payload is preserved. There is no automatic repair or backup export yet. Legacy sessions with ambiguous shared user IDs require signing in again; existing reports are not reassigned. Community posts use the separate versioned `trace_community_v1` key, also with save-before-success behavior. Data remains local to this browser, without cross-tab concurrency guarantees or cross-device sharing.

Photo processing blocks Continue/Submit until it finishes, supports an image-element fallback when `createImageBitmap` is unavailable, and ignores results after leaving the form. Reports without photos show a placeholder rather than an unrelated sample image. Scanner cancellation covers pending startup and unmount; actual-device camera verification is still needed.

## Routes

| Path | Page |
| --- | --- |
| `/` | Homepage |
| `/discover` | Search & filter listings |
| `/community` | Mandaluyong demo Community Board |
| `/items/:id` | Item details + QR |
| `/report` | Multi-step report form |
| `/claim/:itemId` | Claim & verification |
| `/dashboard` | User dashboard |
| `/admin` | Admin review dashboard |
| `/signin` | Demo sign in |
| `/privacy`, `/terms` | Legal |

## Notes on AI matching

The dashboard ranks found reports against each of your lost reports using public description text (TF-IDF cosine similarity), category, date, and location. Scores are ranking signals, **not probabilities of ownership**. The homepage example remains illustrative. Every return requires human verification and a recorded handoff.

## License

MIT
