CREATE TABLE data_lifecycle_tasks(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    task_type TEXT NOT NULL,
    profile_id varchar(12) NOT NULL REFERENCES profiles (id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    scheduled_at TIMESTAMPTZ NOT NULL,
    retry_count SMALLINT NOT NULL DEFAULT 0,
    error TEXT NULL,
    -- used to insert specific params for each task type
    metadata JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW (),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW ()
);

-- Index for faster task_type queries
CREATE INDEX idx_data_lifecycle_tasks_task_type ON data_lifecycle_tasks(task_type);

-- Composite index for pending tasks query (status = 'pending' AND scheduled_at < NOW())
CREATE INDEX idx_data_lifecycle_tasks_pending_scheduled ON data_lifecycle_tasks(status, scheduled_at)
    WHERE status = 'pending';