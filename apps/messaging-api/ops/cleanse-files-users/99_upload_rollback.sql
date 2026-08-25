-- =============================================================================
-- 99_upload_rollback.sql
-- TARGET DATABASE: UPLOAD  (upload-api)
-- =============================================================================
-- Emergency rollback. Re-inserts the rows deleted by 04_upload_cleanse_chunked
-- for a given RUN_ID, restoring the exact (file_id, user_id, shared_at) values
-- from cleanse_files_users_backup.
--
-- Idempotent: ON CONFLICT DO NOTHING, so re-running does no harm. Only affects
-- rows recorded for the given RUN_ID.
--
-- Requires: step 04 was run with this RUN_ID and cleanse_files_users_backup
-- still holds the snapshot.
-- =============================================================================

\set ON_ERROR_STOP on

\if :{?RUN_ID}
\else
  \echo 'ERROR: RUN_ID is not set. e.g. -v RUN_ID=prod-2026-07-30a'
  \quit
\endif

\echo '================ ROLLBACK ================'
\echo 'run_id =' :'RUN_ID'

\echo '--- rows available to restore for this run_id ---'
SELECT count(*) AS restorable_rows
FROM cleanse_files_users_backup
WHERE run_id = :'RUN_ID';

\echo 'Restoring deleted rows...'
INSERT INTO files_users (file_id, user_id, shared_at)
SELECT file_id, user_id, shared_at
FROM cleanse_files_users_backup
WHERE run_id = :'RUN_ID'
ON CONFLICT (file_id, user_id) DO NOTHING;

\echo '--- restored rows now present in files_users ---'
SELECT count(*) AS present_after_restore
FROM cleanse_files_users_backup b
JOIN files_users fu ON fu.file_id = b.file_id AND fu.user_id = b.user_id
WHERE b.run_id = :'RUN_ID';

\echo 'Rollback complete for run_id=' :'RUN_ID'
