CREATE INDEX CONCURRENTLY idx_messages_org_user_seen_scheduled
ON messages (organisation_id, user_id, is_seen, scheduled_at);