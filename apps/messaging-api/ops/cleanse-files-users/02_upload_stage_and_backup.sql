-- =============================================================================
-- 02_upload_stage_and_backup.sql
-- TARGET DATABASE: UPLOAD  (upload-api)  <-- where files / files_users live
-- =============================================================================
-- Step 2 of 5. Creates the (empty) scaffolding used by the CSV load (driven by
-- run.sh), the dry-run (03), cleanse (04), validation (05) and rollback (99)
-- steps:
--   * cleanse_legit_file_user  - staging table; run.sh loads step 01's CSV into
--                                it (the legit (file_id, user_id) message pairs)
--   * cleanse_files_users_backup - audit/rollback table for deleted rows
--   * cleanse_bad_rows(...)    - the candidate-based set-difference that defines
--                                a BAD row (single source of truth for the report
--                                + backup). The chunked DELETE proc in step 04
--                                inlines the SAME predicate and MUST be kept in
--                                sync with this function.
--
-- This file ONLY creates helper objects and TRUNCATEs the staging table so the
-- load starts clean. It loads NO data (psql's `\copy` cannot interpolate the CSV
-- path, so run.sh drives the load with `psql -c "\copy ... FROM '$CSV'"`) and
-- performs NO deletes against files_users. Deletes happen ONLY in step 04.
--
-- SAFETY: prove in dev -> uat, then PROD report-only (03) before any delete.
-- =============================================================================

\set ON_ERROR_STOP on

\echo 'Creating staging + backup objects on the UPLOAD DB...'

-- Legit pairs staged from messaging (step 01), loaded by run.sh.
CREATE TABLE IF NOT EXISTS cleanse_legit_file_user (
    file_id uuid          NOT NULL,
    user_id varchar(255)  NOT NULL,
    PRIMARY KEY (file_id, user_id)
);

TRUNCATE cleanse_legit_file_user;

-- Backup / audit table for rows that will be (or have been) deleted.
-- Keyed by run_id so multiple runs are independently reversible.
CREATE TABLE IF NOT EXISTS cleanse_files_users_backup (
    file_id      uuid          NOT NULL,
    user_id      varchar(255)  NOT NULL,
    shared_at    timestamptz   NOT NULL,
    backed_up_at timestamptz   NOT NULL DEFAULT now(),
    run_id       text          NOT NULL,
    PRIMARY KEY (file_id, user_id, run_id)
);

-- -----------------------------------------------------------------------------
-- cleanse_bad_rows(p_org, p_exclude, p_users, p_require_external_id)
--   Returns the candidate-based set of BAD (file_id, user_id) rows to delete:
--     * migrated files only        : files.external_id IS NOT NULL — but ONLY
--                                    when p_require_external_id = true (the
--                                    default). This is a PROD-only scope guard:
--                                    prod's migrated rows carry external_id,
--                                    whereas dev/uat never ran the digital-postbox
--                                    migration so external_id is ALWAYS NULL there.
--                                    Set p_require_external_id = false in dev/uat
--                                    to drop THIS predicate only; org + candidate
--                                    + non-legit-pair + exclude still scope the
--                                    deletion. Keep it true (default) in prod so
--                                    behaviour is unchanged.
--     * migrated org               : files.organization_id = p_org
--     * CANDIDATE file             : files_users.file_id is a message attachment,
--                                    i.e. it appears in cleanse_legit_file_user
--                                    (SELECT DISTINCT file_id ...). Files that are
--                                    never message attachments are never
--                                    candidates and are therefore never touched,
--                                    which protects legitimate direct /permissions
--                                    shares on non-message files.
--     * not a legit pair           : no matching (file_id, user_id) row in
--                                    cleanse_legit_file_user, i.e. the direct
--                                    message recipients+senders from step 01
--     * repro-leak exclusion       : file_id NOT IN p_exclude (belt & braces)
--     * user-batch scoping         : fu.user_id = ANY (p_users). CONVENTION:
--                                    an EMPTY p_users array means ALL users
--                                    (full scope) — used by the full report; a
--                                    NON-EMPTY array scopes to that batch of
--                                    user_ids, so the delete (04) can cleanse a
--                                    controlled batch (e.g. 20 users) at a time,
--                                    interleaved with export-based verification.
--
--   The migration window (shared_at) scoping was intentionally REMOVED: it was
--   fragile (risked missing bad rows just outside a hand-picked window) and
--   external_id + organization_id already scope to the migrated data. The
--   candidate restriction additionally prevents fully orphaning a migrated file
--   that has no message attachment at all.
--
--   LINKED PROFILES: no special handling. A parent's access to a child's file is
--   read-time derived in upload-api (userCanAccessFileOrThrow falls back to the
--   child's linked ids) and creates NO files_users row, so the cleanse cannot
--   remove linked access. A stray parent-keyed files_users row (which should not
--   exist) is treated like any other non-legit row; deleting it is harmless
--   because the parent still sees the file via the read-time fallback.
--
--   ASSUMPTION/LIMITATION: for a candidate file (a message attachment) the
--   message recipient/sender set is treated as the ONLY legitimate holder set.
--   A legitimate non-message direct /permissions share of such a file to a
--   non-recipient WOULD be removed. In this domain message-attachment files are
--   shared only via messages, so this is accepted.
--   >>> KEEP THIS PREDICATE IN SYNC with the DELETE in 04_upload_cleanse_chunked.sql <<<
--   >>> Both now include the user-batch filter below; keep them identical.       <<<
-- -----------------------------------------------------------------------------
-- Drop old signatures first to avoid overload ambiguity when the arg list grows.
DROP FUNCTION IF EXISTS cleanse_bad_rows(text, uuid[]);
DROP FUNCTION IF EXISTS cleanse_bad_rows(text, uuid[], varchar[]);
CREATE OR REPLACE FUNCTION cleanse_bad_rows(
    p_org                 text,
    p_exclude             uuid[]    DEFAULT '{}'::uuid[],
    p_users               varchar[] DEFAULT '{}'::varchar[],
    p_require_external_id  boolean   DEFAULT true
)
RETURNS TABLE (file_id uuid, user_id varchar, shared_at timestamptz)
LANGUAGE sql
STABLE
AS $$
    SELECT fu.file_id, fu.user_id, fu.shared_at
    FROM files_users fu
    JOIN files f ON f.id = fu.file_id
    LEFT JOIN cleanse_legit_file_user l
           ON l.file_id = fu.file_id AND l.user_id = fu.user_id
    WHERE (p_require_external_id = false OR f.external_id IS NOT NULL)
      AND f.organization_id = p_org
      AND fu.file_id IN (SELECT DISTINCT file_id FROM cleanse_legit_file_user)
      AND l.file_id IS NULL
      AND NOT (fu.file_id = ANY (p_exclude))
      AND (cardinality(p_users) = 0 OR fu.user_id = ANY (p_users));
$$;

\echo 'Staging table + helpers created (empty). Next: run.sh loads the legit-pairs CSV, then 03 reports.'
