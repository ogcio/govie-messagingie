-- AB#41240 preflight verification for PR #781 (attachments_messages UNIQUE rollout).
--
-- READ-ONLY. Contains SELECTs only: NO INSERT/UPDATE/DELETE/DDL. Safe to paste
-- into a live/prod psql session. Run this BEFORE migration
-- 028.do.dedupe-attachments-messages.sql to see, up front, whether any
-- (message_id, attachment_id) duplicates exist and exactly how many rows the
-- dedupe DELETE would remove.
--
-- Keeper logic mirrored from 028.do.dedupe-attachments-messages.sql:
--   DELETE FROM attachments_messages a USING attachments_messages b
--   WHERE a.message_id = b.message_id AND a.attachment_id = b.attachment_id
--     AND a.id > b.id;
-- i.e. keep the lowest id per (message_id, attachment_id) pair; delete the rest.
--
-- How to run (read-only, single session):
--   psql "$MESSAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f verify.sql
-- Nothing here writes, so no transaction wrapper is required.

\pset pager off
\timing off

\echo '================================================================'
\echo 'AB#41240 preflight: attachments_messages (message_id, attachment_id)'
\echo '================================================================'

\echo ''
\echo '--- [1] Total rows in attachments_messages ---'
SELECT count(*) AS total_rows FROM attachments_messages;

\echo ''
\echo '--- [2] Distinct (message_id, attachment_id) pairs ---'
SELECT count(*) AS distinct_pairs
FROM (
  SELECT DISTINCT message_id, attachment_id FROM attachments_messages
) d;

\echo ''
\echo '--- [3] Duplicate GROUPS (pairs with count > 1) ---'
SELECT count(*) AS duplicate_groups
FROM (
  SELECT message_id, attachment_id
  FROM attachments_messages
  GROUP BY message_id, attachment_id
  HAVING count(*) > 1
) g;

\echo ''
\echo '--- [4] Rows that would be REMOVED by 028 (two independent methods) ---'
\echo '    set-arithmetic  = total rows - distinct pairs'
\echo '    keeper-logic    = exact predicate of the 028 DELETE (a.id > b.id)'
\echo '    These MUST be equal; delta = 0 proves the count matches the migration.'
SELECT
  (SELECT count(*) FROM attachments_messages)
    - (SELECT count(*) FROM (SELECT DISTINCT message_id, attachment_id FROM attachments_messages) d)
    AS rows_removed_set_arithmetic,
  (SELECT count(*)
     FROM attachments_messages a
    WHERE EXISTS (
      SELECT 1 FROM attachments_messages b
       WHERE a.message_id = b.message_id
         AND a.attachment_id = b.attachment_id
         AND a.id > b.id
    ))
    AS rows_removed_keeper_logic,
  (SELECT count(*) FROM attachments_messages)
    - (SELECT count(*) FROM (SELECT DISTINCT message_id, attachment_id FROM attachments_messages) d)
    - (SELECT count(*)
         FROM attachments_messages a
        WHERE EXISTS (
          SELECT 1 FROM attachments_messages b
           WHERE a.message_id = b.message_id
             AND a.attachment_id = b.attachment_id
             AND a.id > b.id
        ))
    AS delta_should_be_zero;

\echo ''
\echo '--- [5] Max duplication factor + top 20 offending pairs ---'
SELECT max(cnt) AS max_rows_for_a_single_pair
FROM (
  SELECT count(*) AS cnt
  FROM attachments_messages
  GROUP BY message_id, attachment_id
) c;

SELECT message_id, attachment_id, count(*) AS row_count, count(*) - 1 AS extra_rows
FROM attachments_messages
GROUP BY message_id, attachment_id
HAVING count(*) > 1
ORDER BY count(*) DESC, message_id, attachment_id
LIMIT 20;

\echo ''
\echo '--- [6] VERDICT: would UNIQUE (message_id, attachment_id) be violated NOW? ---'
\echo '    constraint_would_be_violated = true  -> duplicates exist; 028 dedupe IS needed'
\echo '    constraint_would_be_violated = false -> already clean; 028 is a no-op'
SELECT
  EXISTS (
    SELECT 1
    FROM attachments_messages
    GROUP BY message_id, attachment_id
    HAVING count(*) > 1
  ) AS constraint_would_be_violated,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM attachments_messages
      GROUP BY message_id, attachment_id HAVING count(*) > 1
    )
    THEN 'DUPLICATES PRESENT: run 028 dedupe before 029/030 (constraint would fail on raw data)'
    ELSE 'CLEAN: no duplicates; 028 is a no-op and 029/030 are safe to apply'
  END AS verdict;

\echo ''
\echo '=== preflight complete (read-only; nothing was modified) ==='
