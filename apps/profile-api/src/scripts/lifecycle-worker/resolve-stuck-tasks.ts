import type { Pool, PoolClient } from "pg";
import type { Logger } from "pino";
import {
  type LifecycleTask,
  LifecycleTaskStatuses,
} from "~/schemas/data-lifecycle-tasks/index.js";
import { getLifecycleTaskDbFieldsToSelect } from "~/services/data-lifecycle-tasks/get-task-to-process.js";
import { createTaskStatusManager } from "./task-status-manager.js";
import { MAX_RETRY_COUNT } from "./types.js";

export async function resolveStuckTasks(
  params: {
    logger: Logger;
    isStuckAfterMinutes: number;
  } & ({ pool: Pool } | { client: PoolClient }),
): Promise<Record<string, string>> {
  const { logger, isStuckAfterMinutes } = params;
  logger.info("Starting to resolve stuck lifecycle tasks");

  const client =
    "client" in params ? params.client : await params.pool.connect();
  const results: Record<string, string> = {};
  try {
    const stuckTasks = await getStuckTasks(client, isStuckAfterMinutes, logger);

    logger.info({ count: stuckTasks.length }, "Found stuck lifecycle tasks");
    for (const task of stuckTasks) {
      const taskStatusManager = createTaskStatusManager({
        task,
        maxRetryCount: MAX_RETRY_COUNT,
        client,
      });
      const newStatus = await taskStatusManager.setPendingOrFailed(
        "Task marked as failed by lifecycle worker due to being stuck in processing state for over 60 minutes",
      );
      logger.info(
        { taskId: task.id, previousStatus: task.status, newStatus },
        "Updated status of stuck lifecycle task",
      );
      results[task.id] = newStatus;
    }
  } catch (error) {
    logger.error(error, "Error resolving stuck tasks");
  } finally {
    // Do not release the client if it was passed in
    if (!("client" in params)) {
      client.release();
    }
  }

  logger.info("Finished resolving stuck lifecycle tasks");

  return results;
}

async function getStuckTasks(
  client: PoolClient,
  isStuckAfterMinutes: number,
  logger: Logger,
): Promise<LifecycleTask[]> {
  const stuckSince = new Date(Date.now() - isStuckAfterMinutes * 60 * 1000);
  logger.info({ stuckSince }, "Checking for tasks stuck since");

  const result = await client.query<LifecycleTask>(
    `
      SELECT
        ${getLifecycleTaskDbFieldsToSelect()}
      FROM data_lifecycle_tasks
      WHERE status = $1
        AND updated_at < $2
    `,
    [LifecycleTaskStatuses.Processing, stuckSince],
  );

  return result.rows;
}
