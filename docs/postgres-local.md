# TRACE local PostgreSQL foundation

TRACE has a PostgreSQL schema, a server-only repository, and a local HTTP API. The
React app still uses its browser demo store: there is no deployed API, verified
production login, upload service, or automatic import of demo data. Do not expose
the repository or a database connection to a browser. No AWS resources are
created by these files.

## Local development

Use a dedicated local PostgreSQL database and a separate database role. Node
24.15.0 and PostgreSQL 18.3 were used for the local verification; the planned
deployment uses the `postgres:18-alpine` image. Install the locked dependencies
using `npm ci`.

After creating a dedicated, empty database using your local PostgreSQL tools,
provide its connection string to the migration command in your environment:

```powershell
$env:TRACE_DATABASE_URL = 'postgresql://<local-user>@127.0.0.1:5432/<dedicated-trace-database>'
npm.cmd run db:migrate
```

Replace the placeholders locally. Supply the password through a secure local
PostgreSQL credential mechanism; do not commit passwords, `.env` files, or
connection strings. A second run recognizes migration 1 and leaves it alone.
The migration creates tables in the `trace` schema; it does not create users,
roles, a database, community records, application sessions, or cloud resources.
Do not point it at an existing application database without reviewing the SQL.

For integration tests, create a **separate empty local test database** whose
name starts with `trace_test_`, then set `TRACE_POSTGRES_TEST_URL` to its
loopback connection URL and run `npm.cmd run test:postgres`. The suite refuses
non-loopback hosts, names without that prefix, and a database that already has
a `trace` schema. It creates the schema and synthetic fixtures in the test
database and does not remove them; create a fresh dedicated database for the
next run. Never use a real application's data for these tests.

```powershell
$env:TRACE_POSTGRES_TEST_URL = 'postgresql://<local-user>@127.0.0.1:5432/trace_test_example'
npm.cmd run test:postgres
```

## What exists

- `backend/postgres/001_initial.sql` creates users, communities, memberships,
  reports, private references, media metadata, claims and answers, handoffs,
  notifications, audit events, and community posts. A public reports view
  excludes private references, account information, claims, and object keys.
- `backend/postgres/repository.mjs` provides server-only report, bounded matching,
  review-queue, claim, review, handoff, evidence, and notification operations.
  Matching considers at most 200 recent same-category found reports in the
  community and returns at most three heuristic results; private details are
  excluded. Transactions use PostgreSQL
  serializable isolation; conflicting concurrent writes can return a retryable
  service error. Partial unique indexes also prevent two approved claims for
  the same found report or linked lost report. Handoff retries use an explicit
  idempotency key. A caller must retry a retryable transaction failure with the
  same key; there is no HTTP retry handling yet.
- `scripts/postgres-migrate.mjs` applies the initial migration with an advisory
  lock. It does not yet detect migration checksum drift. `scripts/postgres-test.mjs` verifies access scoping, rollback, simultaneous
  approvals, database constraints, linked returns, and repeat-safe handoffs.

- `backend/api/` is the local HTTP layer: `server.mjs` (Node HTTP wrapper and graceful shutdown), `app.mjs` (routes, bearer-token authentication, shared Zod request schemas, DTO mapping, contract error/status mapping, CORS allowlist, 256 KB body cap), and `jwt.mjs` (Cognito JWKS verification with `jose`, access or ID token, audience check). Verified identities are mapped to a local user and community membership; an `admin` Cognito group maps to the `admin` role and never downgrades an existing admin. `scripts/api-test.mjs` covers 16 handler cases with a fake repository and verifier. The API is not deployed and the React app does not call it yet.
- `deploy/ec2/` contains the planned single-instance deployment: API image, Docker Compose stack with PostgreSQL, one-shot migration, Caddy HTTPS, and an AL2023 setup script. It has not been run against AWS.

The repository accepts an `actorId` **only from a trusted server boundary**.
That boundary is now the local API, which derives identity from a verified Cognito
token; it has not been exercised against the real pool. Before deployment, review
production database roles, TLS, backups, pagination, photo operations, log
retention, and the remaining community operations. Database views alone do not
protect private data if an API/database role has unrestricted table access. The
audit table is not yet protected by production grants or an immutable log.

## AWS later

The selected deployment is one small EC2 instance running the API and PostgreSQL
in Docker Compose with Caddy HTTPS, instead of API Gateway/Lambda plus RDS. Check
the account's Free plan credits and create a budget alert first. The instance is
a single point of failure: plan OS patching, `pg_dump` backups, log retention,
and a teardown procedure. Browser demo data must never be uploaded automatically.
See [aws-starter.md](./aws-starter.md) for the console steps.

## Dependency advisory

The earlier high-severity Zod 3 advisory (GHSA-mrhx-c7xc-m3w5) is resolved:
`zod` is 4.6.7 with `@hookform/resolvers` 7.x and `npm audit` reports zero
vulnerabilities. The API still caps request bodies and bounds collection sizes
before schema parsing.
