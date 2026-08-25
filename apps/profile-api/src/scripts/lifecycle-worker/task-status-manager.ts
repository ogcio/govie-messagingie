import type { Pool, PoolClient } from "pg";
import {
  type LifecycleTask,
  LifecycleTaskStatuses,
} from "~/schemas/data-lifecycle-tasks/index.js";
import { updateTaskStatus } from "~/services/data-lifecycle-tasks/update-task-status.js";
import type { Metadata } from "./types.js";

interface TaskStatusManager {
  /**
   * If the task has already failed the maximum number of times, set its status to 'Failed',
   * otherwise set it to the provided status.
   *
   * @param task The task to update
   * @param error optional error message
   */
  setPendingOrFailed(error?: string): Promise<string>;
  startProcessing(): Promise<void>;
  markAsCompleted(metadata?: Metadata): Promise<void>;
  markAsFailed(error: string): Promise<void>;
}

export const createTaskStatusManager = (
  params: {
    maxRetryCount: number;
    task: LifecycleTask;
  } & ({ client: PoolClient } | { pool: Pool }),
): TaskStatusManager => {
  const { maxRetryCount, task } = params;
  const queryEngine = "client" in params ? params.client : params.pool;

  return {
    async setPendingOrFailed(error?: string): Promise<string> {
      const newStatus =
        task.retry_count + 1 >= maxRetryCount
          ? LifecycleTaskStatuses.Failed
          : LifecycleTaskStatuses.Pending;
      await updateTaskStatus({
        taskId: task.id,
        client: queryEngine,
        status: newStatus,
        error,
        updateRetryCount: true,
      });

      return newStatus;
    },
    async startProcessing(): Promise<void> {
      await updateTaskStatus({
        taskId: task.id,
        client: queryEngine,
        status: LifecycleTaskStatuses.Processing,
      });
    },
    async markAsCompleted(metadata?: Metadata): Promise<void> {
      await updateTaskStatus({
        taskId: task.id,
        client: queryEngine,
        status: LifecycleTaskStatuses.Completed,
        updateRetryCount: true,
        metadata,
      });
    },
    async markAsFailed(error: string): Promise<void> {
      await updateTaskStatus({
        taskId: task.id,
        client: queryEngine,
        status: LifecycleTaskStatuses.Failed,
        error,
        updateRetryCount: true,
      });
    },
  };
};
