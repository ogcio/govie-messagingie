ALTER TABLE data_lifecycle_tasks
DROP COLUMN IF EXISTS requester_application_id,
DROP COLUMN IF EXISTS requester_user_id;