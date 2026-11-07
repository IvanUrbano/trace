# TRACE backend contract

Status: defined and tested locally. The user selected PostgreSQL, and a local
server-only repository and initial migration now exist. No AWS resources or
HTTP server exist yet. The React app still uses browser-local demo data. This document records the decisions that the future
API must implement so the frontend and backend do not diverge.

Code artifacts:

| Path | Role |
| --- | --- |
| `src/lib/contract/` | Shared statuses, error model, public/restricted DTO schemas, request/response schemas |
| `src/lib/service/types.ts` | `TraceService` — the async application-service interface |
| `src/lib/service/domain.ts` | Authoritative pure operations over `TraceData` (rules, side effects, migration) |
| `src/lib/store.tsx` | React demo adapter: same operations, synchronous, `localStorage` persistence |
| `backend/postgres/001_initial.sql` | PostgreSQL tables, private-field separation, partial unique indexes, public reports view |
| `backend/postgres/repository.mjs` | Local server-only transactional repository; verified HTTP identity is not implemented |
| `scripts/postgres-test.mjs` | Dedicated local PostgreSQL tests, including concurrent approvals and retry-safe handoffs |
| `scripts/contract-test.mjs` | Domain tests: isolation, conflicting decisions, privacy, migration (`npm run test:contract`) |

## 1. Service operations

`TraceService` (future API) and the domain functions (demo today) implement
the same operations. The future backend must supply a verified `actor`; the
demo uses an unverified local actor. Request
bodies never carry owner, claimant, or reviewer identity (zod strips unknown
keys, so smuggled `ownerId` fields are ignored).

| Operation | Access | Failure codes |
| --- | --- | --- |
| `listPublicItems` / `getPublicItem` | Public; public fields only | `not_found` |
| `createReport` | Verified user; server assigns owner and id | `unauthorized`, `validation` |
| `listMyReports` | Current user's reports only | `unauthorized` |
| `listMatches` | Current user's own lost report only | `unauthorized`, `not_found` |
| `submitClaim` | Verified user; item eligibility and duplicate checks | `unauthorized`, `validation`, `conflict` |
| `listMyClaims` | Claimant only | `unauthorized` |
| `reviewClaim` | Admin only; one approved claimant per item | `unauthorized`, `forbidden`, `validation`, `conflict` |
| `recordHandoff` | Admin only; approved claim plus note ≥ 5 trimmed characters | `unauthorized`, `forbidden`, `validation`, `conflict` |
| `listNotifications` / `markNotificationsRead` | Current user's records only | `unauthorized` |
| `requestPhotoUpload` | Verified user; scoped key, type/size limits | Defined in schema; demo implementation deferred |

Domain rules enforced in one place (`domain.ts`):

- No claim on a returned item, no self-claim, no duplicate claim by the same
  user, no claim after an approval exists.
- Administrators cannot review their own claims. The demo has one admin login;
  a second reviewer is covered by domain fixtures, not a second demo account.
- At most one approved claimant per found item; a second approval is a
  `conflict`.
- An optional linked lost report must be the claimant's active report. Approval
  and handoff recheck it, and a second claim cannot be approved for that same
  lost report. The backend must enforce these checks atomically across devices.
- Handoff requires an approved claim on an `awaiting_handoff` item and a note
  of at least five trimmed characters; it returns the item, rejects competing
  pending/review claims, notifies claimant and competitors, and writes an
  audit entry with actor, target, timestamp, and note.
- A rejected claim with no other open claims returns the item to `unclaimed`.
- A linked handoff closes other pending claims for that lost report, notifies
  their claimant, and reopens alternate found items if no open claims remain.
- Claim status, item status, timelines, notifications, and audit entries are
  updated together in the same returned `TraceData` (single write in the API).

## 2. Public vs restricted responses

- `publicItemSchema` contains only: `id`, `type`, `title`, `category`,
  `description`, `location`, `date`, `status`, `images`, `createdAt`,
  `timeline`. It has no owner, private-detail, claimant, contact, or reviewer
  fields — the absence is structural, not a UI filter.
- `restrictedItemSchema` (owner/admin) adds `ownerId`, `ownerName`,
  `privateDetails`.
- `restrictedClaimSchema` (claimant/reviewer) carries statement, ownership
  answers, contact email, admin note, and optional `relatedLostReportId`.
  Claims are never public.
- `auditEntrySchema` is administrator-only.
- Tests assert that no private key appears on the public schema or its parsed
  output (`scripts/contract-test.mjs`).

## 3. Status model and migration

Current item statuses: `unclaimed`, `claim_pending`, `awaiting_handoff`,
`returned`, `active`.

- `claim_under_review` was renamed to `awaiting_handoff` (it meant
  "approved, handoff not yet recorded").
- Browser persistence uses `trace_state_v2` / `trace_state_v2_user`. Loading
  falls back to the v1 keys, migrates item statuses through
  `migrateItemStatus`, drops items whose status cannot be migrated, and
  rejects structurally invalid payloads back to seed data. v1 keys are left in
  place. Nested items/timelines, claims/answers, notifications, and audit
  entries are now schema-validated. Invalid nested payloads show sample data
  with writes blocked; the original payload is preserved. Loading alone does
  not rewrite browser data; valid migrations are saved on the next successful
  mutation. Dates/relationships are not exhaustively repaired or reconciled.
- Existing demo data is browser-local and must not be uploaded to the backend
  automatically; the API starts with its own records.

## 4. Report relationship and evidence workflow

Decisions for the lost/found pairing problem:

1. **Matching creates no durable link.** Scored suggestions are advisory and
   computed on demand from public text only. A lost report and a found report
   are paired durably only when the claimant links their own lost report at
   claim time via the optional `relatedLostReportId`. The claim form offers the
   claimant's own active lost reports; the domain rejects invalid links.
2. **Reviewer evidence for a claim** is restricted to: the claim statement,
   ownership answers, claimant contact email, the found item's public details
   plus the finder's `privateDetails` (reference details), and — when a lost
   report is linked — that lost report's `privateDetails` (proof details).
   None of it appears in public responses.
3. **Closing both sides:** recording a handoff marks the found item
   `returned`. If the approved claim has a `relatedLostReportId` owned by the
   claimant, that lost report is closed in the same operation (status
   `returned`, final timeline event done). Unlinked lost reports stay active;
   a manual "I found it" close flow for owners is deferred.

Both report types allow optional private reference details. The demo admin
panel shows the found report's reference and the claimant's linked lost report
details for manual comparison. This is browser-local demo data; authorization
and field separation must be enforced by the future API, not the React UI.
Office intake, custody transfers, disputed claims, and policy for unclaimed
items still need an agreed workflow.

## 5. Error model

| Code | HTTP | Meaning |
| --- | --- | --- |
| `unauthorized` | 401 | No verified identity |
| `forbidden` | 403 | Identity lacks the role (e.g. non-admin review) |
| `not_found` | 404 | Missing resource, or exists but not visible to this actor (prevents id probing) |
| `validation` | 422 | Request failed schema validation; `field` names the input |
| `conflict` | 409 | State conflict (duplicate claim, second approval, returned item) |
| `service_unavailable` | 503 | Retryable infrastructure failure (`retryable: true`) |

Every failed operation returns exactly one `ApiError`
(`{ code, message, field?, retryable }`). The UI success path must follow
confirmed persistence; optimistic success without a server confirmation is not
allowed once the API exists.

## 6. Validation performed

- `npm run typecheck`, `npm run test:matching` (4), `npm run test:hero-timeline`
  (8), `npm run test:contract` (16), `npm run build`, and
  `npm run test:consistency` (32/32 with preview server) on 2026-11-04.
- The contract suite covers: public-field absence, owner/admin scoping,
  per-user lists, identity-from-actor, claim eligibility matrix, single
  approver, reject-revert, handoff atomicity and retry conflict, linked lost
  report closure, match visibility, v1→v2 migration, and error/status mapping.

## 7. Deferred to later phases

- `requestPhotoUpload` schema exists; the demo has no upload implementation.
- Dashboard matching still calls `rankFoundMatches` directly instead of
  `listMatches` (same logic, not yet routed through the service facade).
- API implementation of `TraceService` (Phase C), API adapter in the store
  (Phase D), and complete persisted-record relationship reconciliation.
- PostgreSQL repository currently covers reports, bounded matching, review
  queue/evidence, claims, decisions, handoffs, and notifications. It is not a
  complete `TraceService`: public cursor pagination, DTO mapping, community
  operations, and photo uploads are still missing. Matching retrieves at most
  200 recent same-category found reports from the same community before ranking.
  There is no HTTP server or verified-token integration.

## 8. Local reliability and community demo (2026-11-05)

- A mobile browser workflow verified private references, optional lost-report
  linking, administrator review, and two-report closure at handoff. Domain tests
  cover self-review denial, linked-report conflicts, and competing claims. These
  local checks do not establish cross-device atomicity.

- The demo store writes the next snapshot before publishing React state or
  success feedback. Failed storage writes keep the prior state and allow retry.
  A current-data ref prevents same-render mutations from using an old snapshot;
  this does not provide cross-tab or multi-device concurrency control.
- Demo sessions require a valid name/email and the expected email-derived ID
  and role. Ambiguous legacy sessions sign in again without transferring old
  report ownership. Sign-out writes a null marker so a v1 session cannot reappear.
  All demo identities remain unverified and editable through browser storage.
- Community operations live separately in `src/lib/community.ts` and use
  `trace_community_v1`: actor-derived author, member updates/tips, admin-only
  announcements, author/admin soft removal. `/community` is a local Mandaluyong
  demo, not an official city service. Posts do not affect matching or claims.
  Comments, voting, reporting/appeals, moderation audit history, retention,
  pagination, and production community API operations are deferred.
