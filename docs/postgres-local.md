# TRACE local PostgreSQL foundation

TRACE now has a PostgreSQL schema and a server-only repository. The React app
still uses its browser demo store: there is no HTTP API, verified login, upload
service, or automatic import of demo data. Do not expose the repository or a
database connection to a browser. No AWS resources are created by these files.

## Local development

Use a dedicated local PostgreSQL database and a separate database role. Node
24.15.0 and PostgreSQL 18.3 were used for the local verification; PostgreSQL
version and compatibility with the chosen RDS engine must be pinned and tested
before deployment. Install the locked dependencies using `npm ci`.

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

The repository accepts an `actorId` **only from a trusted server boundary**.
That boundary does not exist yet. The next API must verify authentication,
derive actor identity server-side, enforce authorization on every operation,
limit request bodies before parsing, map errors safely, grant least-privilege
database roles, use TLS and secure connection settings, and implement remaining
pagination, response mapping, community, and photo operations. Database views alone do
not protect private data if an API/database role has unrestricted table access.
The audit table is not yet protected by production grants or an immutable log.

## AWS later

The chosen production direction is PostgreSQL, with Amazon RDS for PostgreSQL
as a candidate managed service. Before provisioning, check account eligibility,
credits, current regional pricing, backup/storage and idle-instance costs, and
budget alerts. RDS is not automatically free. Database network access,
credentials, connection pooling, backups, recovery, and migration compatibility
still need a deployment design. Browser demo data must never be uploaded
automatically.

## Dependency advisory

`npm audit` reported one existing high-severity advisory for the project's
Zod 3.25.76: [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
The suggested fix is a breaking Zod 4 upgrade. Claim and report repository
inputs are bounded before shared schema parsing, but that is not a general fix.
Upgrade and test Zod compatibility, add strict HTTP body limits, and rerun the
audit before exposing an API to untrusted requests.
