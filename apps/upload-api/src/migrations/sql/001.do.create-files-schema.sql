-- Baseline: create files table with final snake_case schema.
-- Safe to run against existing prod databases: uses IF NOT EXISTS guards
-- so every statement is a no-op if the object already exists.

CREATE TABLE IF NOT EXISTS files (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key             VARCHAR(255) NOT NULL,
    owner           VARCHAR(255) NOT NULL,
    last_scan       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    infected        BOOLEAN NOT NULL DEFAULT FALSE,
    infection_description TEXT DEFAULT NULL,
    deleted         BOOLEAN NOT NULL DEFAULT FALSE,
    file_size       INTEGER,
    mime_type       VARCHAR(255),
    file_name       VARCHAR(255) DEFAULT NULL,
    antivirus_db_version TEXT DEFAULT NULL,
    organization_id TEXT DEFAULT NULL,
    scheduled_deletion_at TIMESTAMPTZ DEFAULT NULL,
    deleted_at      TIMESTAMPTZ DEFAULT NULL,
    expires_at      TIMESTAMPTZ DEFAULT NULL,
    external_id     VARCHAR(255) DEFAULT NULL
);

-- Columns added after initial table creation; guarded so adoption is
-- non-destructive when the column already exists in prod.
ALTER TABLE files ADD COLUMN IF NOT EXISTS antivirus_db_version TEXT DEFAULT NULL;
ALTER TABLE files ADD COLUMN IF NOT EXISTS organization_id TEXT DEFAULT NULL;
ALTER TABLE files ADD COLUMN IF NOT EXISTS scheduled_deletion_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE files ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE files ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE files ADD COLUMN IF NOT EXISTS external_id VARCHAR(255) DEFAULT NULL;

-- Lookup indexes – all guarded with IF NOT EXISTS.
CREATE INDEX IF NOT EXISTS idx_files_key
    ON files (key);

CREATE INDEX IF NOT EXISTS idx_files_owner
    ON files (owner);

CREATE INDEX IF NOT EXISTS idx_files_owner_org_active
    ON files (owner, organization_id)
    WHERE deleted = FALSE AND scheduled_deletion_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_files_org_active
    ON files (organization_id)
    WHERE deleted = FALSE AND scheduled_deletion_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_files_scheduled_deletion
    ON files (scheduled_deletion_at)
    WHERE deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_files_owner_filename_deleted
    ON files (owner, file_name, deleted);

-- Canonical active-lookup partial index on id.
-- If a legacy idx_files_id_active already exists in prod it satisfies the same
-- predicate; we only create the new canonical name when neither exists.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename  = 'files'
          AND indexname  IN ('idx_files_active_lookup', 'idx_files_id_active')
    ) THEN
        CREATE INDEX idx_files_active_lookup
            ON files (id)
            WHERE deleted = FALSE AND scheduled_deletion_at IS NULL;
    END IF;
END;
$$;
