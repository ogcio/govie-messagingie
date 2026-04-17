CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_user_scheduled
ON messages (
    user_id,
    scheduled_at,
    id
)
WHERE scheduled_at IS NOT NULL;
