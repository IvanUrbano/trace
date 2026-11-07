-- TRACE PostgreSQL foundation. Apply once to a dedicated, empty database.
-- This migration creates no login roles, network access, cloud resources, or
-- demo users. The future API is responsible for verified identity and grants.
BEGIN;

CREATE SCHEMA trace;

CREATE TABLE trace.schema_migrations (
  version integer PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trace.communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trace.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_issuer text NOT NULL CHECK (length(btrim(identity_issuer)) > 0),
  identity_subject text NOT NULL CHECK (length(btrim(identity_subject)) > 0),
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (identity_issuer, identity_subject)
);

-- Private profile fields are never part of the public listing view.
CREATE TABLE trace.user_private_details (
  user_id uuid PRIMARY KEY REFERENCES trace.users(id),
  email text NOT NULL CHECK (length(btrim(email)) BETWEEN 3 AND 320)
);

CREATE TABLE trace.community_memberships (
  community_id uuid NOT NULL REFERENCES trace.communities(id),
  user_id uuid NOT NULL REFERENCES trace.users(id),
  role text NOT NULL CHECK (role IN ('member', 'reviewer', 'admin')),
  PRIMARY KEY (community_id, user_id)
);

CREATE TABLE trace.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES trace.communities(id),
  owner_id uuid NOT NULL REFERENCES trace.users(id),
  type text NOT NULL CHECK (type IN ('lost', 'found')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 200),
  category text NOT NULL CHECK (length(btrim(category)) BETWEEN 1 AND 120),
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 20 AND 5000),
  location text NOT NULL CHECK (length(btrim(location)) BETWEEN 1 AND 200),
  report_date date NOT NULL,
  status text NOT NULL CHECK (
    (type = 'lost' AND status IN ('active', 'returned')) OR
    (type = 'found' AND status IN ('unclaimed', 'claim_pending', 'awaiting_handoff', 'returned'))
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, type),
  UNIQUE (id, owner_id, type),
  UNIQUE (id, community_id)
);

CREATE TABLE trace.report_private_details (
  report_id uuid PRIMARY KEY REFERENCES trace.reports(id),
  reference_details text NOT NULL CHECK (length(btrim(reference_details)) BETWEEN 1 AND 5000)
);

CREATE TABLE trace.report_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES trace.reports(id),
  object_key text NOT NULL UNIQUE CHECK (length(btrim(object_key)) BETWEEN 1 AND 1024),
  position smallint NOT NULL CHECK (position BETWEEN 0 AND 3),
  content_type text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 5000000),
  UNIQUE (report_id, position)
);

CREATE TABLE trace.report_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES trace.reports(id),
  label text NOT NULL,
  description text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  done boolean NOT NULL DEFAULT false
);

CREATE TABLE trace.claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  item_type text NOT NULL DEFAULT 'found' CHECK (item_type = 'found'),
  claimant_id uuid NOT NULL REFERENCES trace.users(id),
  related_lost_report_id uuid,
  related_lost_type text NOT NULL DEFAULT 'lost' CHECK (related_lost_type = 'lost'),
  statement text NOT NULL CHECK (length(btrim(statement)) BETWEEN 20 AND 5000),
  contact_email text NOT NULL CHECK (length(btrim(contact_email)) BETWEEN 3 AND 320),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')),
  reviewer_note text CHECK (reviewer_note IS NULL OR length(reviewer_note) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, claimant_id),
  UNIQUE (id, item_id),
  UNIQUE (id, item_id, claimant_id),
  FOREIGN KEY (item_id, item_type) REFERENCES trace.reports(id, type),
  FOREIGN KEY (related_lost_report_id, claimant_id, related_lost_type)
    REFERENCES trace.reports(id, owner_id, type)
);

CREATE UNIQUE INDEX claims_one_approved_per_found ON trace.claims (item_id) WHERE status = 'approved';
CREATE UNIQUE INDEX claims_one_approved_per_lost ON trace.claims (related_lost_report_id)
  WHERE status = 'approved' AND related_lost_report_id IS NOT NULL;

CREATE TABLE trace.claim_answers (
  claim_id uuid NOT NULL REFERENCES trace.claims(id),
  question_key text NOT NULL CHECK (length(btrim(question_key)) > 0),
  question text NOT NULL CHECK (length(btrim(question)) > 0),
  answer text NOT NULL CHECK (length(btrim(answer)) > 0),
  PRIMARY KEY (claim_id, question_key)
);

CREATE TABLE trace.handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL UNIQUE,
  found_item_id uuid NOT NULL UNIQUE,
  recorded_by uuid NOT NULL REFERENCES trace.users(id),
  recipient_id uuid NOT NULL REFERENCES trace.users(id),
  idempotency_key uuid NOT NULL,
  note text NOT NULL CHECK (length(btrim(note)) BETWEEN 5 AND 2000),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recorded_by, idempotency_key),
  FOREIGN KEY (claim_id, found_item_id, recipient_id) REFERENCES trace.claims(id, item_id, claimant_id)
);

CREATE TABLE trace.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES trace.users(id),
  title text NOT NULL,
  message text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trace.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES trace.users(id),
  action text NOT NULL,
  target_id uuid NOT NULL,
  detail text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trace.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES trace.communities(id),
  author_id uuid NOT NULL REFERENCES trace.users(id),
  category text NOT NULL CHECK (category IN ('Community update', 'Lost-and-found tip', 'Announcement')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 5 AND 120),
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 15 AND 3000),
  status text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'removed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reports_browse ON trace.reports (community_id, type, status, created_at DESC, id DESC);
CREATE INDEX reports_match_candidates ON trace.reports (community_id, category, created_at DESC, id DESC)
  WHERE type = 'found' AND status <> 'returned';
CREATE INDEX reports_by_owner ON trace.reports (owner_id, created_at DESC);
CREATE INDEX claims_by_claimant ON trace.claims (claimant_id, created_at DESC);
CREATE INDEX claims_review_queue ON trace.claims (status, created_at) WHERE status IN ('pending', 'under_review');
CREATE INDEX notifications_by_user ON trace.notifications (user_id, created_at DESC);
CREATE INDEX community_posts_visible ON trace.community_posts (community_id, created_at DESC) WHERE status = 'visible';

-- No owner, private proof, email, claims, reviewer notes, or object keys.
CREATE VIEW trace.public_reports AS
SELECT id, community_id, type, title, category, description, location, report_date, status, created_at
FROM trace.reports;

INSERT INTO trace.schema_migrations (version) VALUES (1);
COMMIT;
