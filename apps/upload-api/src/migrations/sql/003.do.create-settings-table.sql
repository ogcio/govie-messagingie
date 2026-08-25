-- Baseline: create settings table.
-- Translates: 20240918075102-add-settings-table
-- Schema matches storeConfig.ts usage exactly.

CREATE TABLE IF NOT EXISTS settings (
    id          SERIAL PRIMARY KEY,
    key         VARCHAR(255) NOT NULL UNIQUE,
    value       TEXT NOT NULL,
    type        TEXT,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
