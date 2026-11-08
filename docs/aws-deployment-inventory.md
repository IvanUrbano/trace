# TRACE AWS deployment inventory

Updated: 2026-11-08. This is the source of truth for AWS resources that have actually been created for TRACE. It records non-sensitive configuration only. Do not add AWS account numbers, ARNs, user-pool IDs, app-client IDs, email addresses, passwords, tokens, secret keys, database URLs, or credit balances.

## Deployment scope

| Environment | Region | Account plan | Status |
| --- | --- | --- | --- |
| Controlled development testing | Asia Pacific (Singapore), `ap-southeast-1` | AWS Free plan; check Billing before every additional service | Cognito directory, static Amplify Hosting frontend, and one EC2 instance running the API and PostgreSQL; the browser demo store remains the source for writes |

The account owner reviewed the remaining credit and Free-plan expiry in AWS Billing on 2026-11-07 and created a monthly cost budget with an 80% actual-spend alert. A single `t3.micro` instance now runs the API and PostgreSQL in Docker Compose (see below), and an S3 bucket stores public photos. No API Gateway, Lambda, RDS database, or CloudWatch configuration exists.

## Provisioned services

### AWS Amplify Hosting

| Setting | Current configuration |
| --- | --- |
| Purpose | Static production build of the React SPA |
| Region | `ap-southeast-1` |
| Source | GitHub `IvanUrbano/trace`, branch `main`, auto-deploy on push |
| Build spec | Repository `amplify.yml`: `npm ci`, `npm run build`, artifacts in `dist` |
| Runtime | `.nvmrc` / `engines` pin Node 24.15.0; build image Amazon Linux 2023 (default) |
| Public URL | `https://main.d2oswv5myenb38.amplifyapp.com/` |
| Environment variables | `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`, `VITE_COGNITO_DOMAIN`, `VITE_API_BASE_URL` (public SPA values, not secrets) |
| Scope | Static frontend only; no shared records. Report creation and photo upload post to the live EC2 API when `VITE_API_BASE_URL` is set |
| SPA rewrite | Applied: `</^[^.]+$|\\.(?!(css|gif|ico|jpg|jpeg|js|png|txt|svg|webp|woff|woff2|ttf|map|json|manifest|webmanifest)$)([^.]+$)/>` → `/index.html` (200); deep links return the app shell. The JSON source needs escaped dots; an earlier unescaped-dot rule also rewrote `/assets/*.js` to HTML (MIME error), and its stale edge cache entry required a redeploy. |
| Verified | Root document and hashed JS/CSS assets return HTTP 200; `/discover`, `/signin`, `/items/...`, and `/community` return 200 (2026-11-08) |
| Outstanding | The API-backed workflow for claims/review/handoff |

### Amazon Cognito User Pools

| Setting | Current configuration |
| --- | --- |
| Purpose | Controlled identity testing for TRACE |
| Region | `ap-southeast-1` |
| Feature plan | Essentials |
| Sign-in identifier | Email only |
| Self-registration | Disabled; only administrators can create test users currently |
| App client | `TRACE Web`, configured as a single-page application |
| App-client secret | None, which is required for a browser SPA |
| Managed login | AWS-provided Cognito domain exists; exact domain is supplied through ignored local settings |
| Local callback | `http://localhost:5173/` (the app's configured redirect); the app client also lists a legacy `http://localhost:5173/auth/callback` entry |
| Local sign-out return | `http://localhost:5173/` |
| Amplify callback | `https://main.d2oswv5myenb38.amplifyapp.com/` |
| Amplify sign-out return | `https://main.d2oswv5myenb38.amplifyapp.com/` |
| Authentication | Choice-based sign-in, Secure Remote Password, and existing-session token retrieval |
| Token settings | Access and ID tokens: 60 minutes; refresh token: 5 days; authentication-flow session: 3 minutes |
| Security settings | Token revocation and user-existence error protection enabled |
| Authorization group | `admin`, for trusted reviewer accounts only |
| Test users | One controlled test user exists and belongs to `admin`; no personal details are recorded here |

## Provisioned backend (2026-11-08)

| Setting | Current configuration |
| --- | --- |
| Purpose | Node HTTP API and PostgreSQL for shared public listings; report creation and photo uploads go through the API |
| Service | One Amazon EC2 instance, `t3.micro`, Amazon Linux 2023, `ap-southeast-1`, with an Elastic IP |
| Public API | `https://54.254.106.234.sslip.io` (Caddy + Let's Encrypt, HTTP-01 challenge) |
| Runtime | Docker Compose: `postgres:18-alpine` (volume at `/var/lib/postgresql`), `node:24-alpine` API image, one-shot migration container, `caddy:2-alpine` |
| Network | Security group: SSH from the owner's IP only; 80 and 443 public; no public database or API port |
| Host tooling | Docker Engine, Compose plugin, and buildx (installed by `setup.sh`); 2 GB swap |
| Secrets | Database password, Cognito settings, and `S3_BUCKET`/`S3_REGION`/`S3_PUBLIC_BASE_URL` in a root-only `deploy/ec2/.env`; never committed |
| Data | `scripts/seed-demo-reports.sql` inserted seven public demo reports into the `Mandaluyong` community; no accounts, claims, or private data |
| Verified | `GET /health` returns `{"ok":true}`; `GET /api/items` returns the seeded listings; `POST /api/reports` returns 401 `unauthorized` without a token; report creation with bearer token succeeds (2026-11-08) |
| Outstanding | Claims/review/handoff write adapters still browser-demo only, photo orphaned-upload cleanup, community API, backups |
| Photos | `POST /api/photos/presign` returns a presigned S3 PUT URL; photos are uploaded directly to S3 and object keys stored in `report_media`. End-to-end photo upload verified 2026-11-08: signed-in user submitted a report with a photo and confirmed it renders on the item page and in Discover. Requires an S3 bucket and EC2 instance profile with S3 put/get permissions. |

## Integration status

The React application has an environment-gated Cognito OIDC session using authorization code with PKCE. It is disabled until ignored local Vite settings provide the user-pool and app-client values. Navigation reflects Sign In / My Account / Sign Out. Login preserves a validated local destination; logout clears the local OIDC user and redirects through the managed-login logout endpoint. The homepage and browsing remain public. In Cognito mode, old demo identities are ignored, report/claim/dashboard/admin routes require login then display an unavailable-online notice, and community is read-only. Tokens and groups do not authorize browser-demo mutations or database operations.

A deployed API now exists at `https://54.254.106.234.sslip.io`. It verifies Cognito access/ID tokens against the pool's JWKS before mapping the identity to a local user and membership; that verification has only been exercised with a fake verifier and a real signed-in user through the Amplify origin, not against arbitrary tokens. Public listing routes need no token. `src/lib/api/publicItems.ts` adds an env-gated read-only adapter for Discover and item details, with the browser demo as fallback when `VITE_API_BASE_URL` is unset. The deployed Amplify bundle is configured with `VITE_API_BASE_URL` pointing at the EC2 API, so report creation and photo upload flow through the live backend.

Verification on 2026-11-08: build/typecheck, two auth-navigation unit tests, reliability tests 11/11, and a simulated-provider browser flow passed. Browser checks cover old demo-session isolation, PKCE, intended-page return, logout, invalid return URLs, expired sessions, and mobile/tablet navigation. Desktop/mobile screenshots were inspected. A real sign-in with the controlled test user from the deployed Amplify origin succeeded on 2026-11-08; the account required a permanent password set through the Cognito admin API. Sign-out from the deployed origin also works. Report creation with a bearer token and photo upload to S3 were verified end-to-end on 2026-11-08: signed in at the Amplify origin, submitted a report with a photo, confirmed the photo renders on the item page and in Discover. Invitation delivery and API-backed claims/review/handoff operations remain unverified.

## Required next work

1. Create the budget alert, then provision the EC2 instance, security group, and Elastic IP described above.
2. Deploy the API image, apply the migration, and verify `/health`, 401 responses for unauthenticated routes, and a real Cognito access token against the deployed API.
3. Connect the session to authenticated API adapters and replace the unavailable-online notices with real operations; never enable demo admin shortcuts in Cognito mode.
4. Test an invited user sign-in, a regular user without `admin`, and an `admin` user against the deployed API on separate browsers.
5. Add backups (`pg_dump` or volume snapshots), OS patching, log retention, and a documented teardown/restore procedure before sharing the environment.

## Operations and cleanup

- Use only Singapore for TRACE resources unless the architecture and cost review are updated first.
- Do not put resource identifiers or credentials in committed files or frontend secrets.
- Do not enable public self-registration until TRACE has a working signup, email-verification, recovery, and abuse-control flow.
- Before the Free plan expires or credits are depleted, decide whether to upgrade intentionally or delete the Cognito test directory and any later test resources.
- EC2 cleanup: stop or terminate the instance, release the Elastic IP (an unassociated Elastic IP can accrue charges), delete the security group, and delete the volume only after a final backup decision.
