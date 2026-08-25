-- =============================================================================
-- 01_messaging_extract_legit_pairs.sql
-- TARGET DATABASE: MESSAGING  (messaging-api)  <-- NOT the upload DB
-- =============================================================================
-- One-off cleanse of the digital-postbox migration CROSS JOIN fan-out in the
-- upload-api `files_users` table. This is step 1 of 5.
--
-- READ ONLY on the messaging DB. This file performs NO writes and NO deletes.
-- It streams the *legitimate* (file_id, user_id) pairs — the authoritative
-- link between a file and a user — to STDOUT as CSV. The driver (run.sh)
-- redirects that CSV into a file that step 02 loads into the upload DB staging
-- table. Streaming to STDOUT (instead of a `\copy ... TO :'CSV_PATH'`) is
-- deliberate: psql's `\copy` does NOT perform variable interpolation, so the
-- output path is controlled by the shell (`psql -f 01... > "$CSV"`), never by a
-- psql variable.
--
-- Legitimacy rule (mirrors profile PR #757, the read-time fix):
--   A file is legitimately a user's iff a message where they are the RECIPIENT
--   (messages.user_id) attaches it (attachments_messages.attachment_id).
--   Recipient-only: the buggy migration only ever inserted RECIPIENT rows into
--   files_users, and senders reach their files via org ownership (files.owner /
--   organization_id), not a files_users share — so there are no sender-keyed
--   rows on the migrated scope to protect. Verified zero-impact before removal.
--
-- USAGE (via the driver): run.sh runs
--   psql "$MESSAGING_DSN" -X -q -f 01_messaging_extract_legit_pairs.sql > "$CSV"
-- Standalone: append `> /path/to/legit.csv` to the same psql invocation.
--
-- SAFETY: run the whole flow in dev -> uat first, and PROD report-only
--   (step 03) before any delete (step 04). Never run 04 before 03 is reviewed.
-- =============================================================================

\set ON_ERROR_STOP on

-- Distinct legit pairs: recipient attachments only.
-- Streamed to STDOUT as CSV; the shell captures it into the legit-pairs file.
COPY (
    SELECT DISTINCT am.attachment_id AS file_id, m.user_id AS user_id
    FROM attachments_messages am
    JOIN messages m ON m.id = am.message_id
    WHERE m.user_id IS NOT NULL
) TO STDOUT WITH (FORMAT csv, HEADER true);
