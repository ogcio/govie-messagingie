-- =============================================================================
-- 03_upload_dry_run_report.sql
-- TARGET DATABASE: UPLOAD  (upload-api)
-- =============================================================================
-- Step 3 of 5. DRY RUN — 100% READ ONLY. This file performs NO deletes and NO
-- writes to files_users. It reports EXACTLY which (file_id, user_id) rows step
-- 04 would delete, so a human can review before anything is removed.
--
-- >>> DO NOT run 04_upload_cleanse_chunked.sql until this report is reviewed. <<<
-- >>> In PROD, run this report FIRST and get sign-off before any delete.     <<<
--
-- Requires: step 02 has been run (staging table + cleanse_bad_rows() exist).
-- =============================================================================

\set ON_ERROR_STOP on

-- ---- required-parameter guard ----------------------------------------------
\if :{?MIGRATED_ORG}
\else
  \echo 'ERROR: MIGRATED_ORG is not set. e.g.  -v MIGRATED_ORG=the-org-value'
  \quit
\endif

-- Default the repro-leak exclusion list (dev fileB + uat fileB) if unset.
\if :{?EXCLUDE_FILE_IDS}
\else
  \set EXCLUDE_FILE_IDS '{c295d8e1-8501-4724-83cc-ac7fe56961aa,ee1dc5f4-0bfd-40b7-950f-10b1723923d4}'
\endif

-- Optional user-batch scoping. Empty (unset) = full report over ALL users;
-- non-empty = scope the report to that batch of user_ids (mirrors the delete
-- batch you're about to run in 04). Convention matches cleanse_bad_rows().
\if :{?USER_IDS}
\else
  \set USER_IDS '{}'
\endif

-- external_id scoping is PROD-only (dev/uat never ran the migration, so
-- external_id is always NULL there). Default ON; run.sh --no-external-id-filter
-- sets it false so dev/uat can rehearse against org + candidate scoping alone.
\if :{?REQUIRE_EXTERNAL_ID}
\else
  \set REQUIRE_EXTERNAL_ID true
\endif

-- Derive a boolean so the echo below can distinguish full-scope from a batch.
SELECT cardinality(:'USER_IDS'::varchar[]) = 0 AS user_ids_all \gset

\echo '================ DRY RUN (read-only) ================'
\echo 'org   =' :'MIGRATED_ORG'
\echo 'exclude file ids =' :'EXCLUDE_FILE_IDS'
\echo 'require external_id =' :'REQUIRE_EXTERNAL_ID'
-- Echo the user batch; {} (unset) means the report covers all users.
\if :user_ids_all
  \echo 'users = (all users — full scope)'
\else
  \echo 'users =' :'USER_IDS'
\endif
\echo '====================================================='

-- 0) Candidate files = distinct message-attachment files in the legit set.
--    These are the ONLY files the cleanse can ever touch.
\echo '--- (0) candidate files (distinct message-attachment file_ids) ---'
SELECT count(DISTINCT file_id) AS candidate_files
FROM cleanse_legit_file_user;

-- 1) Headline: total bad rows + distinct files/users affected.
\echo '--- (1) totals ---'
SELECT count(*)                    AS bad_rows,
       count(DISTINCT file_id)     AS files_affected,
       count(DISTINCT user_id)     AS users_affected
FROM cleanse_bad_rows(:'MIGRATED_ORG', :'EXCLUDE_FILE_IDS'::uuid[], :'USER_IDS'::varchar[], :'REQUIRE_EXTERNAL_ID'::boolean);

-- 2) Per-file before/after share counts (proves each file keeps its legit shares).
\echo '--- (2) per-file before/after (top 50 by shares_removed) ---'
WITH bad AS (
  SELECT file_id, user_id
  FROM cleanse_bad_rows(:'MIGRATED_ORG', :'EXCLUDE_FILE_IDS'::uuid[], :'USER_IDS'::varchar[], :'REQUIRE_EXTERNAL_ID'::boolean)
)
SELECT fu.file_id,
       count(*)                                       AS shares_before,
       count(*) FILTER (WHERE b.file_id IS NULL)       AS shares_after,
       count(*) FILTER (WHERE b.file_id IS NOT NULL)   AS shares_removed
FROM files_users fu
JOIN files f ON f.id = fu.file_id
LEFT JOIN bad b ON b.file_id = fu.file_id AND b.user_id = fu.user_id
WHERE (:'REQUIRE_EXTERNAL_ID'::boolean = false OR f.external_id IS NOT NULL)
  AND f.organization_id = :'MIGRATED_ORG'
GROUP BY fu.file_id
ORDER BY shares_removed DESC, fu.file_id
LIMIT 50;

-- 3) Full pair list preview (eyeball). The COMPLETE list is exported to CSV by
--    run.sh when --report-csv is given: it runs the same cleanse_bad_rows() set
--    through `psql -c "\copy (...) TO '$REPORT_CSV'"` (psql's `\copy` cannot
--    interpolate a variable path, so the export is driven from the shell, not
--    from a `\copy ... TO :'REPORT_CSV'` here).
\echo '--- (3) full bad pair list (first 200; use run.sh --report-csv /path.csv for all) ---'
SELECT file_id, user_id, shared_at
FROM cleanse_bad_rows(:'MIGRATED_ORG', :'EXCLUDE_FILE_IDS'::uuid[], :'USER_IDS'::varchar[], :'REQUIRE_EXTERNAL_ID'::boolean)
ORDER BY file_id, user_id
LIMIT 200;

-- 4) Manual-validation helper: a small random sample to open/inspect PDFs and
--    confirm each bad file visibly belongs to someone OTHER than user_id.
\echo '--- (4) sample for manual PDF/user inspection ---'
SELECT b.file_id, b.user_id, f.file_name, f.key
FROM cleanse_bad_rows(:'MIGRATED_ORG', :'EXCLUDE_FILE_IDS'::uuid[], :'USER_IDS'::varchar[], :'REQUIRE_EXTERNAL_ID'::boolean) b
JOIN files f ON f.id = b.file_id
ORDER BY random()
LIMIT 10;

\echo 'DRY RUN complete. Review before running 04_upload_cleanse_chunked.sql.'
