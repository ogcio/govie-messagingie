CREATE INDEX CONCURRENTLY idx_messages_scheduled_at_desc
ON messages (scheduled_at DESC);