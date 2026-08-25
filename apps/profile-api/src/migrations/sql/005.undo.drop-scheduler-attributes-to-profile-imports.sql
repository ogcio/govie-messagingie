-- Drop the job_token column from profile_imports table
DROP INDEX IF EXISTS idx_profile_imports_job_token;
ALTER TABLE profile_imports DROP COLUMN IF EXISTS job_token; 