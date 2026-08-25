import type { PoolClient } from "pg";
import type { LifecycleTaskStatus } from "~/schemas/data-lifecycle-tasks/index.js";

export async function updateTaskStatus(params: {
  taskId: string;
  client: { query: PoolClient["query"] };
  status: LifecycleTaskStatus;
  error?: string;
  updateRetryCount?: boolean;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { taskId, client, status, error, updateRetryCount, metadata } = params;
  const retryCountToSum = updateRetryCount ? 1 : 0;
  const response = await client.query<{
    id: string;
  }>(
    `
        UPDATE data_lifecycle_tasks
        SET status = $1,
            error = $2,
            updated_at = NOW(),
            retry_count = retry_count + $4,
            metadata = COALESCE(metadata, '{}'::jsonb) || $5
        WHERE id = $3 RETURNING id
        `,
    [status, error || null, taskId, retryCountToSum, metadata ?? {}],
  );

  if (response.rows.length === 0) {
    throw new Error(`Failed to update task status for task with id ${taskId}`);
  }
}
