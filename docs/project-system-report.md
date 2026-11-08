# TRACE — Project System Report

Last updated: 2026-11-09

## 1. Overview

TRACE is a lost-and-found application. Intended workflow:

`lost/found report → possible match → ownership claim → human review → recorded handoff`

Initial community setting: Mandaluyong (demo). Matching only suggests candidates; a person always decides ownership and records the return.

## 2. Implemented Features

### Reporting
- Lost and found report wizard with validation (title, category, description, location, date, private reference details).
- Up to 4 photos per report (JPEG/PNG/WebP, 5 MB source limit), resized to 1024 px and converted to JPEG.
- Photo processing blocks submission until complete; empty-photo placeholder.
- QR code per item for sharing/scanning.
- Report dates validated (not in the future).

### Discovery
- Filtered listing (type, category, location, date range, text search) with validated URL parameters.
- Item details page with images, status timeline, share/QR.
- Public listings served from the live API when configured, with browser-demo fallback.

### Matching
- Pure, React-independent ranking (reusable in Lambda): same category found items, excluding returned.
- Text similarity (TF-IDF/cosine on title+description), location equality, date relevance. Scores are advisory; threshold 45; max 3 per lost report.
- Dashboard groups possible matches per lost report with supporting factors.

### Claims and Review
- Claim submission with statement, contact email, ownership answers, optional linked lost report.
- Eligibility checks: found item only, not returned, not self-claim, no duplicate by same user, no approved claim exists.
- Admin review: approve/reject/move to review, with evidence comparison (finder reference vs. claimant answers).
- Administrators cannot review their own claims; one approved claimant per found/lost report (DB-enforced).
- Handoff recording requires an approved claim and a note (≥5 chars); atomically marks item returned, closes competing claims, notifies claimants, reopens alternate found items, writes audit event.
- Handoff idempotency via UUID key.

### Notifications and Audit
- In-app notifications (claim submitted, claim decision, item returned).
- Audit log of report/claim/review/handoff events.

### Community Board
- Mandaluyong Community Board: member posts, admin-only announcements, search/filter, author/admin soft removal with confirmation.
- Separate versioned storage; posts do not affect matching or claims.

### Authentication
- Environment-gated Cognito OIDC (authorization code + PKCE).
- Sign In / My Account / Sign Out; login returns to validated local destination; logout via managed login.
- Public browsing remains available; demo shortcuts disabled in Cognito mode.

## 3. AWS Infrastructure (Deployed)

### Frontend
- AWS Amplify Hosting: `https://main.d2oswv5myenb38.amplifyapp.com/` from GitHub `main`.
- Build: `npm ci`, `npm run build`, artifacts in `dist`; Node 24.15.0 pinned via `.nvmrc` and `engines`.
- SPA rewrite rule applied; deep links verified.

### Backend (single EC2 instance)
- One `t3.micro` Amazon Linux 2023 instance in `ap-southeast-1`, Elastic IP `54.254.106.234`.
- Docker Compose stack: PostgreSQL 18, one-shot migration container, Node 24 API, Caddy (automatic HTTPS via Let's Encrypt).
- API: `https://54.254.106.234.sslip.io` — bearer-token auth, Cognito JWKS verification (RS256, issuer/audience), server-derived identity and admin role, shared Zod validation, public/restricted DTOs, CORS allowlist, 256 KB body cap, UUID idempotency keys.
- Database role `trace_app` with INSERT-only on `audit_events` (append-only).
- Daily `pg_dump` backup at 02:00 via cron, retaining 7 backups.

### Storage
- S3 bucket `trace-photos-ivan-020603` with public-read GetObject policy and CORS for PUT from the Amplify origin.
- Presigned PUT uploads; object keys stored in `report_media`; public URLs via `S3_PUBLIC_BASE_URL`.

### Identity
- Amazon Cognito user pool in `ap-southeast-1` with `admin` group and controlled test users.
- Amplify origin registered in callback/sign-out allowlists; real sign-in and sign-out verified.

## 4. Architecture

- Frontend: React 18, TypeScript, Vite 6, React Router 7, Tailwind, Framer Motion.
- Backend: Node 24 HTTP API over PostgreSQL 18 (transactional, serializable claim/review/handoff).
- Shared contract in `src/lib/contract/` (statuses, error model, DTOs, request/response schemas).
- Authoritative mutation layer in `src/lib/service/domain.ts`; `PostgresRepository` is the server implementation.

## 5. Security and Limitations

- Demo identity is not authentication; production uses Cognito.
- Client-side guards are not a security boundary; backend enforces authorization.
- Public responses exclude private fields by construction.
- Audit events are append-only at the DB role level.
- localStorage demo state is browser-local and editable; not authoritative in production.
- Matching is a heuristic, not a validated model; scores are advisory.
- No email/SMS delivery; notifications are in-app only.
- Single EC2 instance is a single point of failure; manual patching and backups.

## 6. Validation Performed

- `npm run typecheck` — pass.
- `npm run build` — pass.
- `test:matching` 4/4, `test:contract` 21/21, `test:reliability` 11/11, `test:api` 16/16, `test:hero-timeline` 10/10.
- `test:auth-browser` — pass.
- PostgreSQL integration tests 9/9 (isolated local cluster).
- Deployed: `/health` 200, `/api/items` returns listings, `/api/me/reports` 401 without token, photo upload end-to-end verified.

## 7. Future Work

- Image matching and richer ranking (embeddings/trained ranker) after labeled evaluation.
- Email/SMS notifications (SES).
- Disputes, appeals, and custody/authority referral policies.
- Pagination, WAF, custom DNS, multi-AZ/redundancy.
- Recovery drills and backup verification.
- Remaining mutations (community API, advanced admin screens) fully live.
- Cursor pagination and index review.
- CI automation for build/typecheck/matching/browser checks.
