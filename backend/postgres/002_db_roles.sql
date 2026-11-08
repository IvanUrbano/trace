-- TRACE database role separation (002).
-- Creates limited-privilege application role for the API runtime.
-- The `trace` user remains the schema owner for migrations.
-- audit_events is INSERT-only for trace_app (append-only, tamper-resistant).

BEGIN;

-- Application role used by the API at runtime.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'trace_app') THEN
    CREATE ROLE trace_app LOGIN PASSWORD :'app_password';
  END IF;
END$$;

GRANT USAGE ON SCHEMA trace TO trace_app;

-- Application role: read everything.
GRANT SELECT ON ALL TABLES IN SCHEMA trace TO trace_app;

-- Application role: write to tables it owns through normal workflow.
GRANT INSERT, UPDATE, DELETE ON
  trace.reports,
  trace.claims,
  trace.notifications,
  trace.report_media,
  trace.report_private_details,
  trace.report_timeline,
  trace.claim_answers,
  trace.communities,
  trace.users,
  trace.community_memberships,
  trace.handoffs
TO trace_app;

-- Application role: INSERT only on audit_events (append-only, no UPDATE/DELETE).
GRANT INSERT ON trace.audit_events TO trace_app;

-- Ensure future tables in the schema also follow the default grant pattern.
ALTER DEFAULT PRIVILEGES IN SCHEMA trace GRANT SELECT TO trace_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA trace GRANT INSERT, UPDATE, DELETE ON
  trace.reports,
  trace.claims,
  trace.notifications,
  trace.report_media,
  trace.report_private_details,
  trace.report_timeline,
  trace.claim_answers,
  trace.communities,
  trace.users,
  trace.community_memberships,
  trace.handoffs
TO trace_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA trace GRANT INSERT ON trace.audit_events TO trace_app;

COMMIT;
