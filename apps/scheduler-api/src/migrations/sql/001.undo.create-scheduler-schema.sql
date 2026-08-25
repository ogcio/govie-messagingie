-- Undo for 001: drop the queue index, then all three scheduler tables.
-- Reliable for fresh/dev databases.
-- On prod, only apply after confirming objects were created by this migration
-- baseline, not by a pre-Postgrator db-migrate run.

DROP INDEX IF EXISTS idx_scheduled_events_queue;
DROP TABLE IF EXISTS event_logs;
DROP TABLE IF EXISTS scheduled_events;
DROP TABLE IF EXISTS config;
