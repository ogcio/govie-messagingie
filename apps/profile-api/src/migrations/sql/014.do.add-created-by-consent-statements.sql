ALTER TABLE consent_statements
-- Nullable because in this way we can use "null"
-- for ones created by seeder
-- still maintaining references to profile
ADD COLUMN created_by varchar(12) NULL REFERENCES profiles (id);