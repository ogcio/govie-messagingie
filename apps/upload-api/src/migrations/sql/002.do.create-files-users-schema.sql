-- Baseline: create files_users sharing table and its lookup index.
-- Merges: 20240822053657-file-sharing-table + 20250710070802-idx-files-users-user-file
-- Guarded with IF NOT EXISTS so adoption is non-destructive.

CREATE TABLE IF NOT EXISTS public.files_users (
    file_id   UUID NOT NULL,
    user_id   VARCHAR(255) NOT NULL,
    shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (file_id, user_id),

    CONSTRAINT fk_file
        FOREIGN KEY (file_id)
        REFERENCES public.files (id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_files_users_user_file
    ON files_users (user_id, file_id);
