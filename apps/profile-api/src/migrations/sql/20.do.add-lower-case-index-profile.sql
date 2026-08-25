CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_lower_email
ON profiles (LOWER(email))
WHERE deleted_at IS NULL;