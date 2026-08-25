-- AB#41240 step 3/3: attach the UNIQUE constraint to the ready index built in 029.
-- USING INDEX is fast (no rescan) but takes a brief ACCESS EXCLUSIVE lock;
-- fail fast rather than parking at the head of the lock queue.
SET lock_timeout = '2s';

ALTER TABLE attachments_messages
ADD CONSTRAINT attachments_messages_msg_att_uq UNIQUE USING INDEX attachments_messages_msg_att_uq;
