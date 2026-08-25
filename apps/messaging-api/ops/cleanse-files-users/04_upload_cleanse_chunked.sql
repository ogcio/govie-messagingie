-- =============================================================================
-- 04_upload_cleanse_chunked.sql
-- TARGET DATABASE: UPLOAD  (upload-api)
-- =============================================================================
-- Step 4 of 5. *** THIS IS THE ONLY FILE THAT DELETES DATA. ***
--
-- >>> DO NOT RUN until 03_upload_dry_run_report.sql has been reviewed/signed off.
-- >>> In PROD, only run after dev+uat rehearsal and a PROD report-only pass.
--
-- What it does:
--   1. Snapshots the full BAD set into cleanse_files_users_backup (for :RUN_ID)
--      BEFORE deleting anything (rollback source; idempotent via ON CONFLICT).
--   2. Creates a plpgsql PROCEDURE with TRANSACTION CONTROL that deletes the bad
--      rows in CHUNKS, COMMITTING after each batch (never one giant DELETE/tx).
--   3. CALLs the procedure.
--
-- Chunking / resumability guarantees:
--   * Batched: at most :CHUNK rows per DELETE (default 5000).
--   * COMMIT per non-empty batch -> short locks, bounded WAL, safe to interrupt.
--   * Idempotent + resumable: the bad set is RECOMPUTED every batch from live
--     data, so re-running after an interruption simply continues; already-deleted
--     rows are gone and won't match again. The backup INSERT also uses
--     ON CONFLICT DO NOTHING, so re-running never loses earlier backup rows.
--   * SKIP LOCKED -> safe if run concurrently / alongside live traffic.
--
-- IMPORTANT: do NOT wrap this file in BEGIN/COMMIT. The procedure manages its
-- own transactions; psql must be in autocommit mode (its default) so that
-- COMMIT inside the procedure is permitted.
--
-- USER-SCOPED DELETE: this step is now driven per user batch. It REQUIRES a
-- non-empty USER_IDS (varchar[]) and only deletes bad rows for those users, so
-- the operator can cleanse in small controlled batches (e.g. 20 users at a
-- time), interleaved with export-based verification, each batch keyed by its
-- own RUN_ID and independently reversible via 99_upload_rollback.sql. An empty
-- USER_IDS is REJECTED (both by a psql guard and a SQL guard) so a batch can
-- never accidentally fall through to a global delete.
-- =============================================================================

\set ON_ERROR_STOP on

-- ---- required-parameter guard ----------------------------------------------
\if :{?MIGRATED_ORG}
\else
  \echo 'ERROR: MIGRATED_ORG is not set. e.g.  -v MIGRATED_ORG=the-org-value'
  \quit
\endif
\if :{?RUN_ID}
\else
  \echo 'ERROR: RUN_ID is not set (audit/rollback key). e.g. -v RUN_ID=prod-2026-07-30a'
  \quit
\endif
\if :{?USER_IDS}
\else
  \echo 'ERROR: USER_IDS is not set. The delete is USER-SCOPED and requires a'
  \echo '       NON-EMPTY batch of user_ids, e.g. -v USER_IDS='"'"'{profile-id-1,profile-id-2}'"'"''
  \quit
\endif

-- Optional params with defaults.
\if :{?CHUNK}
\else
  \set CHUNK 5000
\endif
\if :{?EXCLUDE_FILE_IDS}
\else
  \set EXCLUDE_FILE_IDS '{c295d8e1-8501-4724-83cc-ac7fe56961aa,ee1dc5f4-0bfd-40b7-950f-10b1723923d4}'
\endif
-- external_id scoping is PROD-only (prod's migrated rows carry external_id;
-- dev/uat never ran the migration so external_id is always NULL there). Default
-- ON; set false in dev/uat (run.sh --no-external-id-filter) to drop that filter.
\if :{?REQUIRE_EXTERNAL_ID}
\else
  \set REQUIRE_EXTERNAL_ID true
\endif

\echo '================ CLEANSE (DELETES DATA) ================'
\echo 'org    =' :'MIGRATED_ORG'
\echo 'chunk  =' :CHUNK
\echo 'run_id =' :'RUN_ID'
\echo 'exclude file ids =' :'EXCLUDE_FILE_IDS'
\echo 'users  =' :'USER_IDS'
\echo 'require external_id =' :'REQUIRE_EXTERNAL_ID'
\echo '======================================================='

-- ---- SQL-side non-empty guard: a batch can NEVER fall through to "all" -------
-- (Belt & braces alongside the psql \if guard above: even if USER_IDS is set
--  to an empty array literal, the delete is refused here before any backup.)
-- NOTE: cardinality is evaluated in SQL via \gset (psql does NOT interpolate
-- :'USER_IDS' inside a dollar-quoted DO $$...$$ body), then enforced with \if
-- so the abort message is clear and NOTHING is backed up or deleted.
SELECT cardinality(:'USER_IDS'::varchar[]) = 0 AS user_ids_empty \gset
\if :user_ids_empty
  \echo 'ERROR: USER_IDS must be a NON-EMPTY user batch for the delete step.'
  \quit
\endif

-- ---- 1) backup the batch's bad set BEFORE deleting --------------------------
\echo 'Backing up bad rows to cleanse_files_users_backup (run_id=' :'RUN_ID' ')...'
INSERT INTO cleanse_files_users_backup (file_id, user_id, shared_at, run_id)
SELECT file_id, user_id, shared_at, :'RUN_ID'
FROM cleanse_bad_rows(:'MIGRATED_ORG', :'EXCLUDE_FILE_IDS'::uuid[], :'USER_IDS'::varchar[], :'REQUIRE_EXTERNAL_ID'::boolean)
ON CONFLICT DO NOTHING;

-- ---- 2) chunked delete procedure with transaction control -------------------
-- NOTE: the WHERE predicate below MUST stay identical to cleanse_bad_rows()
--       in 02_upload_stage_and_backup.sql. The candidate restriction
--       (fu.file_id IN (SELECT DISTINCT file_id FROM cleanse_legit_file_user))
--       limits deletes to message-attachment files; the LEFT JOIN + l.file_id
--       IS NULL keeps only rows with no legit (file, user) pair; the
--       user-batch filter (fu.user_id = ANY (p_users)) restricts to the batch;
--       the external_id predicate is gated by p_require_external_id (PROD-only
--       scope guard — see cleanse_bad_rows in 02; dev/uat pass false).
--       Unlike cleanse_bad_rows (empty p_users = all), the DELETE REQUIRES a
--       non-empty p_users and refuses to run otherwise (see guard below).
-- Drop old signature first so the added param can't create an overload clash.
DROP PROCEDURE IF EXISTS cleanse_files_users_delete(text, int, text, uuid[]);
DROP PROCEDURE IF EXISTS cleanse_files_users_delete(text, int, text, uuid[], varchar[]);
CREATE OR REPLACE PROCEDURE cleanse_files_users_delete(
    p_org                 text,
    p_chunk               int       DEFAULT 5000,
    p_run_id              text      DEFAULT 'manual',
    p_exclude             uuid[]    DEFAULT '{}'::uuid[],
    p_users               varchar[] DEFAULT '{}'::varchar[],
    p_require_external_id  boolean   DEFAULT true
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_deleted bigint;
    v_total   bigint := 0;
    v_batch   int    := 0;
BEGIN
    IF p_org IS NULL THEN
        RAISE EXCEPTION 'cleanse_files_users_delete: p_org is required';
    END IF;
    IF p_chunk IS NULL OR p_chunk < 1 THEN
        RAISE EXCEPTION 'cleanse_files_users_delete: p_chunk must be >= 1';
    END IF;
    IF p_users IS NULL OR cardinality(p_users) = 0 THEN
        RAISE EXCEPTION 'cleanse_files_users_delete: p_users (user batch) is required and must be non-empty';
    END IF;

    RAISE NOTICE 'cleanse start: org=% chunk=% run_id=% users=%',
                 p_org, p_chunk, p_run_id, cardinality(p_users);

    LOOP
        WITH victims AS (
            SELECT fu.ctid
            FROM files_users fu
            JOIN files f ON f.id = fu.file_id
            LEFT JOIN cleanse_legit_file_user l
                   ON l.file_id = fu.file_id AND l.user_id = fu.user_id
            WHERE (p_require_external_id = false OR f.external_id IS NOT NULL)
              AND f.organization_id = p_org
              AND fu.file_id IN (SELECT DISTINCT file_id FROM cleanse_legit_file_user)
              AND l.file_id IS NULL
              AND NOT (fu.file_id = ANY (p_exclude))
              AND fu.user_id = ANY (p_users)
            LIMIT p_chunk
            FOR UPDATE OF fu SKIP LOCKED
        )
        DELETE FROM files_users fu
        USING victims v
        WHERE fu.ctid = v.ctid;

        GET DIAGNOSTICS v_deleted = ROW_COUNT;

        IF v_deleted > 0 THEN
            v_total := v_total + v_deleted;
            v_batch := v_batch + 1;
            RAISE NOTICE 'batch % deleted % rows (cumulative %)', v_batch, v_deleted, v_total;
            COMMIT;  -- transaction control: commit after each non-empty chunk
        END IF;

        EXIT WHEN v_deleted = 0;
    END LOOP;

    RAISE NOTICE 'cleanse complete: % batch(es), % row(s) deleted total (run_id=%)',
                 v_batch, v_total, p_run_id;
END;
$$;

-- ---- 3) run it --------------------------------------------------------------
\echo 'Running chunked delete...'
CALL cleanse_files_users_delete(
    :'MIGRATED_ORG',
    :CHUNK,
    :'RUN_ID',
    :'EXCLUDE_FILE_IDS'::uuid[],
    :'USER_IDS'::varchar[],
    :'REQUIRE_EXTERNAL_ID'::boolean
);

\echo 'Cleanse finished. Next: run 05_upload_validate.sql. Rollback (if needed): 99_upload_rollback.sql with the same RUN_ID.'
