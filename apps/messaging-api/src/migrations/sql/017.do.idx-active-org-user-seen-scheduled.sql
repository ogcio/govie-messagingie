CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_org_user_seen_scheduled_active
ON messages (
    organisation_id,
    user_id,
    is_seen,
    scheduled_at DESC
)
WHERE deleted_at IS NULL;
