-- Add metadata column to profile_imports table
ALTER TABLE profile_imports
ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb NOT NULL;

-- Add index for metadata column
CREATE INDEX idx_profile_imports_metadata ON profile_imports USING gin (metadata);

COMMENT ON COLUMN profile_imports.metadata IS 'Stores file-related metadata like filename, mimetype, etc.'; 