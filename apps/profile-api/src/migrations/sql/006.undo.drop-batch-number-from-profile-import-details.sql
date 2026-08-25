-- Drop the batch_number column from profile_import_details table
DROP INDEX IF EXISTS idx_profile_import_details_batch_number;
ALTER TABLE profile_import_details DROP COLUMN IF EXISTS batch_number; 