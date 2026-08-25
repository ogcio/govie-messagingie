-- Baseline: create scheduler tables and queue index.
-- Merges legacy db-migrate migrations:
--   20240503072847-init-tables (scheduled_events, event_logs, config)
--   20260310072847-event-index (idx_scheduled_events_queue)
--
-- Safe to run against existing prod databases: all statements use IF NOT EXISTS
-- guards so every statement is a no-op if the object already exists.
-- Note: gen_random_uuid() requires pgcrypto, which is loaded by the root init.sql.

CREATE TABLE IF NOT EXISTS scheduled_events (
    id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    webhook_url TEXT NOT NULL,
    webhook_auth TEXT,
    execute_at  TIMESTAMPTZ NOT NULL,
    event_status TEXT NOT NULL DEFAULT 'pending',
    retries     INT DEFAULT 0 CHECK (retries >= 0),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_logs (
    event_id    UUID NOT NULL,
    status_code TEXT NOT NULL,
    process_id  TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS config (
    base_interval_ms        INT NOT NULL CHECK (base_interval_ms > 0),
    http_callback_timeout_ms INT NOT NULL CHECK (http_callback_timeout_ms > 0),
    select_size             INT NOT NULL CHECK (select_size > 0),
    max_retries             INT NOT NULL CHECK (max_retries > 0)
);

-- Partial index supporting the worker queue-selection query in src/worker.ts.
-- Carried forward from the legacy event-index migration.
-- CONCURRENTLY is intentionally omitted: the Postgrator runner executes each
-- file through a pooled client connection and has no out-of-transaction escape
-- hatch, so a non-concurrent create is the only safe option here.
-- On already-current databases this is a guarded no-op.
CREATE INDEX IF NOT EXISTS idx_scheduled_events_queue
    ON scheduled_events (execute_at, retries DESC)
    WHERE event_status = 'pending';
