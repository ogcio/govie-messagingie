CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS attachments_messages_msg_att_uq
ON attachments_messages (message_id, attachment_id);
