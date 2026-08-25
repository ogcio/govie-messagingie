-- Undo for 001: drop all files indexes, then the table.
-- Reliable for fresh/dev databases. On prod, only apply after confirming the
-- table was created by this migration baseline, not by a pre-Postgrator run.

DROP INDEX IF EXISTS idx_files_active_lookup;
DROP INDEX IF EXISTS idx_files_id_active;
DROP INDEX IF EXISTS idx_files_owner_filename_deleted;
DROP INDEX IF EXISTS idx_files_scheduled_deletion;
DROP INDEX IF EXISTS idx_files_org_active;
DROP INDEX IF EXISTS idx_files_owner_org_active;
DROP INDEX IF EXISTS idx_files_owner;
DROP INDEX IF EXISTS idx_files_key;
DROP TABLE IF EXISTS files;
