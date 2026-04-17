ALTER TABLE messages
ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
