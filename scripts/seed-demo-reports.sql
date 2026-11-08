BEGIN;

INSERT INTO trace.communities (name)
SELECT 'Mandaluyong'
WHERE NOT EXISTS (SELECT 1 FROM trace.communities c WHERE btrim(c.name) = 'Mandaluyong');

INSERT INTO trace.users (identity_issuer, identity_subject, display_name)
VALUES ('seed:demo', 'demo-finder', 'TRACE Demo Finder')
ON CONFLICT (identity_issuer, identity_subject) DO UPDATE SET display_name = EXCLUDED.display_name;

WITH community AS (
  SELECT id FROM trace.communities WHERE btrim(name) = 'Mandaluyong' ORDER BY created_at, id LIMIT 1
), owner AS (
  SELECT id FROM trace.users WHERE identity_issuer = 'seed:demo' AND identity_subject = 'demo-finder'
), inserted AS (
  INSERT INTO trace.reports (community_id, owner_id, type, title, category, description, location, report_date, status)
  SELECT community.id, owner.id, v.type, v.title, v.category, v.description, v.location, v.report_date, v.status
  FROM community, owner, (VALUES
    ('found', 'Brown leather wallet', 'Wallets & Cards',
     'Brown bifold wallet with a university ID card and two bank cards inside. Found near the library entrance steps.',
     'University Library', CURRENT_DATE - 1, 'unclaimed'),
    ('found', 'Black wireless earbuds case', 'Electronics',
     'Matte black charging case for wireless earbuds, found on a table by the cafe window during the afternoon.',
     'Main Campus Cafe', CURRENT_DATE - 2, 'unclaimed'),
    ('found', 'Silver key ring with three keys', 'Keys',
     'Small silver key ring holding three keys and a blue plastic tag, picked up near the bus terminal benches.',
     'City Bus Terminal', CURRENT_DATE - 3, 'unclaimed'),
    ('found', 'Navy canvas tote bag', 'Bags',
     'Navy canvas tote bag with a notebook and a folded jacket inside, left by the pavilion benches.',
     'Central Park Pavilion', CURRENT_DATE - 4, 'unclaimed'),
    ('found', 'Stainless steel water bottle', 'Water Bottles',
     'Stainless steel bottle with a scratched lid and a small dent near the base, found in the gym lobby.',
     'Riverside Gym', CURRENT_DATE - 5, 'unclaimed'),
    ('lost', 'Lost black umbrella', 'Clothing & Accessories',
     'Compact black folding umbrella with a wooden handle, last seen after the evening lecture.',
     'Student Union', CURRENT_DATE - 2, 'active'),
    ('lost', 'Lost student ID card', 'Wallets & Cards',
     'Student ID card in a clear plastic sleeve, possibly dropped between the library and the parking garage.',
     'North Parking Garage', CURRENT_DATE - 1, 'active')
  ) AS v(type, title, category, description, location, report_date, status)
  WHERE NOT EXISTS (SELECT 1 FROM trace.reports r WHERE r.community_id = community.id)
  RETURNING id, type
)
INSERT INTO trace.report_timeline (report_id, label, description, done)
SELECT id, 'Reported ' || type, 'Report submitted to the community board.', true FROM inserted;

COMMIT;
