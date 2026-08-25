import { httpErrors } from "@fastify/sensible";
import type { PoolClient } from "pg";
import {
  type LifecycleTaskInput,
  LifecycleTaskStatuses,
} from "~/schemas/data-lifecycle-tasks/index.js";

export async function createLifecycleTask(params: {
  client: PoolClient;
  lifecycleTaskInput: LifecycleTaskInput;
}): Promise<{ id: string }> {
  const insertResult = await params.client.query<{ id: string }>(
    `
    INSERT INTO data_lifecycle_tasks 
      (task_type, profile_id, scheduled_at, metadata, status, retry_count, requester_user_id, requester_application_id)
        VALUES ($1, $2, $3, $4, $5, 0, $6, $7)
        RETURNING id
    `,
    [
      params.lifecycleTaskInput.task_type,
      params.lifecycleTaskInput.profile_id,
      params.lifecycleTaskInput.scheduled_at,
      params.lifecycleTaskInput.metadata || {},
      LifecycleTaskStatuses.Pending,
      params.lifecycleTaskInput.requester_user_id,
      params.lifecycleTaskInput.requester_application_id,
    ],
  );

  if (insertResult.rows.length === 0) {
    throw httpErrors.internalServerError("Failed to create lifecycle task");
  }

  return { id: insertResult.rows[0].id };
}

export async function throwIfActiveTaskAlreadyExists(params: {
  client: PoolClient;
  lifecycleTaskInput: Pick<LifecycleTaskInput, "profile_id" | "task_type">;
}): Promise<void> {
  // Allow only one pending or processing task of the same type per profile
  const checkForExistingTask = await params.client.query<{ id: string }>(
    `
    SELECT id FROM data_lifecycle_tasks
    WHERE task_type = $1
      AND profile_id = $2
      AND status IN ($3, $4)
    LIMIT 1
  `,
    [
      params.lifecycleTaskInput.task_type,
      params.lifecycleTaskInput.profile_id,
      LifecycleTaskStatuses.Pending,
      LifecycleTaskStatuses.Processing,
    ],
  );

  if (checkForExistingTask.rows.length > 0) {
    throw httpErrors.badRequest(
      "A lifecycle task of this type is already pending or processing for this profile",
    );
  }
}
