-- Drop the metadata column from profile_imports table
DROP INDEX IF EXISTS idx_profile_imports_metadata;
ALTER TABLE profile_imports DROP COLUMN IF EXISTS metadata; 