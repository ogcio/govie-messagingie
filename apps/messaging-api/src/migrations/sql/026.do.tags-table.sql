CREATE EXTENSION IF NOT EXISTS ltree;

CREATE TABLE IF NOT EXISTS tags (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,
  label         TEXT NOT NULL,
  parent_tag_id UUID REFERENCES tags(id),
  path          ltree NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sibling uniqueness: same user + same label + same parent (NULL-safe)
CREATE UNIQUE INDEX idx_tags_sibling_unique
  ON tags (user_id, label, COALESCE(parent_tag_id, '00000000-0000-0000-0000-000000000000'));

-- GiST index on path for ltree queries (@>, <@, etc.)
CREATE INDEX idx_tags_path_gist ON tags USING gist (path);

-- B-tree indexes for common lookups
CREATE INDEX idx_tags_user_id ON tags (user_id);
CREATE INDEX idx_tags_parent_tag_id ON tags (parent_tag_id);

-- Add tag_id FK to messages
ALTER TABLE messages ADD COLUMN tag_id UUID REFERENCES tags(id);
CREATE INDEX idx_messages_tag_id ON messages (tag_id);
