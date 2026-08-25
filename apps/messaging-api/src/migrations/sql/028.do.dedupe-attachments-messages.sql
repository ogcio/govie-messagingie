-- AB#41240 step 1/3: dedupe (message_id, attachment_id) before adding UNIQUE.
-- Dry-run count of offending rows (run manually before/after to verify):
--   SELECT message_id, attachment_id, count(*) - 1 AS extra
--   FROM attachments_messages GROUP BY 1, 2 HAVING count(*) > 1;
-- Keep the lowest id per (message_id, attachment_id) pair. Idempotent: a no-op once clean.
DELETE FROM attachments_messages a
USING attachments_messages b
WHERE a.message_id = b.message_id
  AND a.attachment_id = b.attachment_id
  AND a.id > b.id;
