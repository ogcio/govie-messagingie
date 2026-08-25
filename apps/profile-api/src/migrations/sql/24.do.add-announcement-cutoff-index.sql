-- Supports the citizen announcement cutoff lookup:
--   WHERE profile_id = ? AND organisation_id IS NULL
--   ORDER BY created_at ASC
--   LIMIT 1
-- The existing profile_details indexes focus on is_latest-based lookups and do
-- not provide ordered access for the earliest null-organisation row.
CREATE INDEX idx_profile_details_profile_null_org_created_at
    ON profile_details (profile_id, created_at)
    WHERE organisation_id IS NULL;

COMMENT ON INDEX idx_profile_details_profile_null_org_created_at IS 'Optimizes earliest null-organisation profile_details lookup for citizen announcement cutoff';