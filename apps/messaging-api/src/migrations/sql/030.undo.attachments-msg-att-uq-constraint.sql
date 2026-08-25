-- Dropping the constraint also drops the backing index (attachments_messages_msg_att_uq).
ALTER TABLE attachments_messages
DROP CONSTRAINT IF EXISTS attachments_messages_msg_att_uq;
