-- Add cascade tracking to profile_consents table
ALTER TABLE profile_consents
ADD COLUMN cascade_reason VARCHAR(50) DEFAULT NULL,
ADD COLUMN cascade_source_profile_id VARCHAR(12) DEFAULT NULL REFERENCES profiles (id);

-- Add index for cascade tracking queries
CREATE INDEX idx_profile_consents_cascade_tracking ON profile_consents (cascade_reason, cascade_source_profile_id);

-- Add constraint to ensure cascade fields are consistent
ALTER TABLE profile_consents
ADD CONSTRAINT check_cascade_fields_consistency 
CHECK (
  (cascade_reason IS NULL AND cascade_source_profile_id IS NULL) OR
  (cascade_reason IS NOT NULL AND cascade_source_profile_id IS NOT NULL)
);

-- Add comment for documentation
COMMENT ON COLUMN profile_consents.cascade_reason IS 'Reason for consent cascade: explicit_consent_submission, account_linking, manual_admin_action';
COMMENT ON COLUMN profile_consents.cascade_source_profile_id IS 'Profile ID that triggered the cascade';
