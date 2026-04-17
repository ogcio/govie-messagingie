CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subject_trgm_active
ON messages
USING gin (subject gin_trgm_ops)
WHERE deleted_at IS NULL;
