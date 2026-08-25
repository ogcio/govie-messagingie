-- =============================================================================
-- 05_upload_validate.sql
-- TARGET DATABASE: UPLOAD  (upload-api)
-- =============================================================================
-- Step 5 of 5. Post-cleanse validation. READ ONLY (no deletes/writes to
-- files_users). Confirms zero residual bad rows and reconciles counts against
-- the backup taken in step 04.
--
-- Requires: steps 02 (+ staging still loaded) and 04 have been run.
-- =============================================================================

\set ON_ERROR_STOP on

-- ---- required-parameter guard ----------------------------------------------
\if :{?MIGRATED_ORG}
\else
  \echo 'ERROR: MIGRATED_ORG is not set.'
  \quit
\endif
\if :{?RUN_ID}
\else
  \echo 'ERROR: RUN_ID is not set.'
  \quit
\endif
\if :{?EXCLUDE_FILE_IDS}
\else
  \set EXCLUDE_FILE_IDS '{c295d8e1-8501-4724-83cc-ac7fe56961aa,ee1dc5f4-0bfd-40b7-950f-10b1723923d4}'
\endif
-- Optional user-batch scoping (mirrors 03/04). Empty (unset) = full scope.
\if :{?USER_IDS}
\else
  \set USER_IDS '{}'
\endif
-- external_id scoping is PROD-only; must match the value used for 04 so the
-- residual check evaluates the same predicate. Default ON (prod); dev/uat false.
\if :{?REQUIRE_EXTERNAL_ID}
\else
  \set REQUIRE_EXTERNAL_ID true
\endif

\echo '================ VALIDATE ================'

-- 1) Residual bad rows must be ZERO.
--    Scoped to USER_IDS: because the delete (04) runs per user batch, residual
--    is only guaranteed 0 for the batch just deleted. Pass the same USER_IDS
--    here so "residual_bad = 0" is evaluated for that batch. (Globally,
--    residual won't reach 0 until every batch has been deleted; run with an
--    empty/unset USER_IDS for the full-scope check once all batches are done.)
\echo '--- (1) residual_bad (expect 0) ---'
SELECT count(*) AS residual_bad
FROM cleanse_bad_rows(:'MIGRATED_ORG', :'EXCLUDE_FILE_IDS'::uuid[], :'USER_IDS'::varchar[], :'REQUIRE_EXTERNAL_ID'::boolean);

-- 2) Reconciliation: rows deleted for this run should equal the backup count
--    for this run (nothing deleted that wasn't backed up first).
\echo '--- (2) backup count for this run_id ---'
SELECT count(*) AS backed_up_rows
FROM cleanse_files_users_backup
WHERE run_id = :'RUN_ID';

-- 3) Confirm none of the backed-up (deleted) rows still exist in files_users.
\echo '--- (3) backed-up rows still present (expect 0) ---'
SELECT count(*) AS still_present
FROM cleanse_files_users_backup b
JOIN files_users fu ON fu.file_id = b.file_id AND fu.user_id = b.user_id
WHERE b.run_id = :'RUN_ID';

-- 4) Spot check: for a sample of affected files, every REMAINING share is now
--    backed by a legit message-attachment pair.
\echo '--- (4) sample: remaining shares are all legit (expect legit_backed = shares_remaining) ---'
WITH sample_files AS (
  SELECT DISTINCT file_id
  FROM cleanse_files_users_backup
  WHERE run_id = :'RUN_ID'
  ORDER BY file_id
  LIMIT 20
)
SELECT fu.file_id,
       count(*) AS shares_remaining,
       count(*) FILTER (
         WHERE l.file_id IS NOT NULL
       ) AS legit_backed
FROM sample_files s
JOIN files_users fu ON fu.file_id = s.file_id
LEFT JOIN cleanse_legit_file_user l
       ON l.file_id = fu.file_id AND l.user_id = fu.user_id
GROUP BY fu.file_id
ORDER BY fu.file_id;

\echo 'Validation complete. If residual_bad = 0 and reconciliation matches, the cleanse succeeded.'
\echo 'Optional: trigger a data export for a sample of affected users and confirm no foreign files appear.'
