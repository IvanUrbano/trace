# TRACE AWS deployment inventory

Updated: 2026-11-08. This is the source of truth for AWS resources that have actually been created for TRACE. It records non-sensitive configuration only. Do not add AWS account numbers, ARNs, user-pool IDs, app-client IDs, email addresses, passwords, tokens, secret keys, database URLs, or credit balances.

## Deployment scope

| Environment | Region | Account plan | Status |
| --- | --- | --- | --- |
| Controlled development testing | Asia Pacific (Singapore), `ap-southeast-1` | AWS Free plan; check Billing before every additional service | Cognito directory and static Amplify Hosting frontend; application data remains browser-local |

The account owner reviewed the remaining credit and Free-plan expiry in AWS Billing on 2026-11-07. The Free plan does not bill charges to the account, but access ends when its credits or time period are exhausted. No budget alert, API, Lambda, RDS database, S3 bucket, or CloudWatch configuration is recorded as created.

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
| Environment variables | `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`, `VITE_COGNITO_DOMAIN` (public SPA values, not secrets) |
| Scope | Static frontend only; no API, database, shared records, or photo upload |
| SPA rewrite | Applied: `</^[^.]+$|\\.(?!(css|gif|ico|jpg|jpeg|js|png|txt|svg|webp|woff|woff2|ttf|map|json|manifest|webmanifest)$)([^.]+$)/>` → `/index.html` (200); deep links return the app shell. The JSON source needs escaped dots; an earlier unescaped-dot rule also rewrote `/assets/*.js` to HTML (MIME error), and its stale edge cache entry required a redeploy. |
| Verified | Root document and hashed JS/CSS assets return HTTP 200; `/discover`, `/signin`, `/items/...`, and `/community` return 200 (2026-11-08) |
| Outstanding | Amplify-origin callback/sign-out URLs in Cognito, real signed-in browser verification |

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
| Local callback | `http://localhost:5173/`, as shown in the user-provided setup guide |
| Local sign-out return | SPA configured for `http://localhost:5173/`; inclusion in AWS allowed sign-out URLs remains unverified |
| Authentication | Choice-based sign-in, Secure Remote Password, and existing-session token retrieval |
| Token settings | Access and ID tokens: 60 minutes; refresh token: 5 days; authentication-flow session: 3 minutes |
| Security settings | Token revocation and user-existence error protection enabled |
| Authorization group | `admin`, for trusted reviewer accounts only |
| Test users | One controlled test user exists and belongs to `admin`; no personal details are recorded here |

## Integration status

The React application has an environment-gated Cognito OIDC session using authorization code with PKCE. It is disabled until ignored local Vite settings provide the user-pool and app-client values. Navigation reflects Sign In / My Account / Sign Out. Login preserves a validated local destination; logout clears the local OIDC user and redirects through the managed-login logout endpoint. The homepage and browsing remain public. In Cognito mode, old demo identities are ignored, report/claim/dashboard/admin routes require login then display an unavailable-online notice, and community is read-only. Tokens and groups do not authorize browser-demo mutations or database operations.

Verification on 2026-11-08: build/typecheck, two auth-navigation unit tests, reliability tests 11/11, and a simulated-provider browser flow passed. Browser checks cover old demo-session isolation, PKCE, intended-page return, logout, invalid return URLs, expired sessions, and mobile/tablet navigation. Desktop/mobile screenshots were inspected. No AWS settings were changed by this code update. Invitation delivery and real AWS login/logout remain unverified.

## Required next work

1. Add and verify the environment-specific callback and logout URLs for local and deployed SPA origins.
2. Upgrade Zod compatibly and add HTTP request-size limits before exposing an API.
3. Add reproducible infrastructure configuration before creating API Gateway, Lambda, S3, or RDS resources.
4. Create an API that verifies Cognito tokens and derives the actor identity and `admin` role server-side.
5. Connect the session to authenticated API adapters and replace the unavailable-online notices with real operations; never enable demo admin shortcuts in Cognito mode.
6. Test an invited user sign-in, a regular user without `admin`, and an `admin` user against the API after it exists.

## Operations and cleanup

- Use only Singapore for TRACE resources unless the architecture and cost review are updated first.
- Do not put resource identifiers or credentials in committed files or frontend secrets.
- Do not enable public self-registration until TRACE has a working signup, email-verification, recovery, and abuse-control flow.
- Before the Free plan expires or credits are depleted, decide whether to upgrade intentionally or delete the Cognito test directory and any later test resources.
