CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profile_data_lower_email
ON profile_data (LOWER(value))
WHERE name = 'email' AND value_type = 'string';