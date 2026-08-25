-- AB#41240: intentionally irreversible. The dedupe DELETE removed duplicate
-- attachments_messages rows; those rows cannot be reconstructed. No-op undo.
SELECT 1;
