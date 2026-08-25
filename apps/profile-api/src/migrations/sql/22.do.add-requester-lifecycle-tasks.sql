ALTER TABLE data_lifecycle_tasks
ADD COLUMN requester_user_id TEXT NULL,
ADD COLUMN requester_application_id TEXT NULL;

COMMENT ON COLUMN data_lifecycle_tasks.requester_user_id IS
'Identifier of the user who requested the creation of the task. 
Present when the task is initiated by a user directly or via an external application acting on behalf of the user. 
Nullable for legacy records created before this field was introduced or for system-generated tasks.';

COMMENT ON COLUMN data_lifecycle_tasks.requester_application_id IS
'Identifier of the application that initiated the request on behalf of the user (machine-to-machine integration). 
Null when the task was requested directly by a user without an intermediary application, or for legacy/system-generated records.';