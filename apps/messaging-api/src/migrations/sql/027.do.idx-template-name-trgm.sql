CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_template_contents_name_trgm
  ON message_template_contents
  USING gin (template_name gin_trgm_ops);
