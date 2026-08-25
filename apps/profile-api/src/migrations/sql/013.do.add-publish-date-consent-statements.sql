ALTER TABLE consent_statements
ADD COLUMN publish_date TIMESTAMPTZ NOT NULL DEFAULT NOW (),
ADD COLUMN is_enabled boolean DEFAULT true NOT NULL;