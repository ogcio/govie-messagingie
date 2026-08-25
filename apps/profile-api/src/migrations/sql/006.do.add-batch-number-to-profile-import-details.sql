-- Add job_token column to profile_imports table
ALTER TABLE profile_import_details
ADD COLUMN batch_number INTEGER NOT NULL DEFAULT 0;

-- Add index for job_token lookups
CREATE INDEX idx_profile_import_details_batch_number ON profile_import_details (batch_number);

COMMENT ON COLUMN profile_import_details.batch_number IS 'Batch number for the profile import'; 