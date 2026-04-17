CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subject_trgm
ON messages
USING gin (subject gin_trgm_ops);
