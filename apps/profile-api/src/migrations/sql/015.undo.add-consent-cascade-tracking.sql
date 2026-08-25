-- Remove cascade tracking from profile_consents table
ALTER TABLE profile_consents
DROP CONSTRAINT IF EXISTS check_cascade_fields_consistency;

DROP INDEX IF EXISTS idx_profile_consents_cascade_tracking;

ALTER TABLE profile_consents
DROP COLUMN IF EXISTS cascade_reason,
DROP COLUMN IF EXISTS cascade_source_profile_id;
