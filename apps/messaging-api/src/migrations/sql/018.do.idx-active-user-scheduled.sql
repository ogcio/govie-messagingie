CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_user_scheduled_active
ON messages (
    user_id,
    scheduled_at DESC,
    id
)
WHERE scheduled_at IS NOT NULL
  AND deleted_at IS NULL;
