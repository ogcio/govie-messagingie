ALTER TABLE batch_recipients
	DROP CONSTRAINT IF EXISTS batch_recipients_canonical_message_id_fkey;

DROP TABLE IF EXISTS batch_messages;
DROP TABLE IF EXISTS batch_recipients;
DROP TABLE IF EXISTS batch_runs;