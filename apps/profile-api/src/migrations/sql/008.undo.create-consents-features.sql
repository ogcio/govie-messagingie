DROP INDEX IF EXISTS idx_profiles_consent_statuses_gin;

ALTER TABLE profiles
DROP COLUMN IF EXISTS consent_statuses;

DROP INDEX IF EXISTS idx_profile_consents_profile_created;

DROP TABLE IF EXISTS profile_consents;