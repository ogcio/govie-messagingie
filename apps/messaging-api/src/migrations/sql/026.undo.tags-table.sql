-- Drop messages.tag_id index and column first (depends on tags)
DROP INDEX IF EXISTS idx_messages_tag_id;
ALTER TABLE messages DROP COLUMN IF EXISTS tag_id;

-- Drop tags indexes
DROP INDEX IF EXISTS idx_tags_parent_tag_id;
DROP INDEX IF EXISTS idx_tags_user_id;
DROP INDEX IF EXISTS idx_tags_path_gist;
DROP INDEX IF EXISTS idx_tags_sibling_unique;

-- Drop tags table
DROP TABLE IF EXISTS tags;

-- Drop ltree extension
DROP EXTENSION IF EXISTS ltree;
