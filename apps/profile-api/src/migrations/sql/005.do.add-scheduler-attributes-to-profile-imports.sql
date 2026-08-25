-- Add job_token column to profile_imports table
ALTER TABLE profile_imports
ADD COLUMN job_token UUID NOT NULL DEFAULT gen_random_uuid();

-- Drop job_id column from profile_imports table
ALTER TABLE profile_imports DROP COLUMN job_id;

-- Add index for job_token lookups
CREATE INDEX idx_profile_imports_job_token ON profile_imports (job_token);

COMMENT ON COLUMN profile_imports.job_token IS 'UUID token used for job authentication'; 