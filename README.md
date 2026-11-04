# TRACE

A modern, minimalist lost & found platform built with React. Report lost belongings, discover found items, submit ownership claims, verify ownership, and track the safe return of property through one transparent workflow.

> Lost something? Let's bring it back.

Development instructions, current limitations, and the ordered implementation roadmap are maintained in [AGENTS.md](AGENTS.md). Update it with every major project change.

## Features

- **Editorial homepage** — scroll-driven 3D WebGL hero opening at 45 degrees, slower scroll pacing and visible text-derived ash across its story chapters, demand-rendered particles, CSS fallback, staggered entrance animations, recently found grid, four-step process timeline, smart matching preview, dark trust & verification section, functional QR section, and final CTA.
- **Discover** — search, category/location/date filters, lost/found toggle, sort by newest or relevance, URL-persisted filter params, skeleton loading and empty/error states.
- **Item details** — photo gallery, description, status timeline, live QR code for the listing, claim CTA. Private identifying details are never rendered publicly.
- **Report an item** — guided 3-step form (basics → details → review) with drag-and-drop photo upload and previews, inline validation, lost/found toggle.
- **Claim & verification** — private ownership questions, claim statement, live claim status with review progress timeline.
- **User dashboard** — lost reports, found reports, my claims, ranked possible matches, notifications, status history.
- **Admin dashboard** — pending claim review queue, approve/decline with notes, recorded handoff details, item reports table, browser audit history. Matching never auto-approves ownership.
- **Microinteractions** — hover/focus/active states, toasts, modals with Escape + focus trap, animated status timelines, QR camera scanner gated behind explicit permission.
- **Motion** — Framer Motion fade-up reveals, staggered grids, image clip reveals, animated dividers and timeline connectors, subtle route transitions. All animations respect `prefers-reduced-motion`.

## Design system

The [hero experience notes](docs/hero-experience.md) describe its visual story, scroll timeline, rendering approach, and performance limits.

| Token | Value |
| --- | --- |
| Main text / deep background | `#171926` |
| Accent / secondary text | `#40506A` |
| Borders / on-dark accent | `#8F9DC0` |
| Light background | `#E7EAF3` |
| Type | System sans (Inter when installed) |
| Icons | Lucide React (monochrome line) |

Slate primary buttons with pale text, pale secondary buttons with navy borders, square/subtle corners, generous whitespace, and Swiss-editorial typography. A subtle circular field behind the hero mark, a lightly tinted matching section, and a dark final call to action use the four-color palette. The floating navigation adds translucent dark-purple glass with rounded blue active highlights; TRACE sits separately on the left and Report an Item on the right. Discover, How It Works, Matching, and sign-in/account links occupy the centered bar.

## Architecture

Proposed first AWS version: Amplify Hosting for the frontend, Cognito for accounts, API Gateway HTTP API and Lambda for backend operations, DynamoDB for records, and private S3 for photos. IAM, CloudWatch, and AWS Budgets support permissions, monitoring, and cost alerts. These services are not deployed yet.

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

Checks: `npm run typecheck`, `npm run test:matching`, `npm run test:hero-timeline`, and `npm run test:consistency` (the consistency suite expects a preview server on port 4173).

For a staged AWS deployment, see [docs/aws-starter.md](docs/aws-starter.md).

## Demo accounts

- **User** — any email address (e.g. `alex@example.com`). Sample data is pre-seeded for `alex@example.com` including a pending claim and notifications.
- **Admin** — `admin@trace.app` opens the review queue and audit log at `/admin`.

Demo state is persisted to `localStorage`; clear site data to reset it. Browser storage is not secure shared storage and should not hold real private ownership details.

## Routes

| Path | Page |
| --- | --- |
| `/` | Homepage |
| `/discover` | Search & filter listings |
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
