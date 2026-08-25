import type { Pool } from "pg";
import type pino from "pino";
import { DPProxyClient } from "~/clients/dp-proxy.js";
import { buildLogtoClient, type LogtoClient } from "~/clients/logto.js";
import type {
  DPProxyConfig,
  LogtoManagementConfig,
  M2MSdksConfig,
} from "~/plugins/external/env.js";
import type {
  LifecycleTask,
  LifecycleTaskType,
} from "~/schemas/data-lifecycle-tasks/index.js";
import { LifecycleTaskTypes } from "~/schemas/data-lifecycle-tasks/index.js";
import { createTaskStatusManager } from "~/scripts/lifecycle-worker/task-status-manager.js";
import { claimNextTask } from "~/services/data-lifecycle-tasks/get-task-to-process.js";
import { AuditLogger } from "~/utils/audit-logger.js";
import { getAuditCollectorSdk } from "~/utils/authentication-factory.js";
import { executeDeleteProfileSteps } from "./steps/delete-profile.js";
import { exportUserDataSdk } from "./steps/export-user-data/index.js";
import { shouldNotifyRequester } from "./steps/export-user-data/notify.js";
import { type AsyncTask, MAX_RETRY_COUNT } from "./types.js";

const COOLDOWN_PERIOD_SECONDS = 3 * 60; // 3 minutes
// Using this we can control which task types the worker will pick up for processing.
const TASK_TYPES_TO_SEARCH_FOR: LifecycleTaskType[] = [
  LifecycleTaskTypes.DeleteProfile,
  LifecycleTaskTypes.ExportUserData,
];

/**
 * Main entry point for executing lifecycle tasks.
 * Retrieves a pending task, processes it, and handles errors.
 */
export async function executeTask(params: {
  logger: pino.Logger;
  pool: Pool;
  dpProxyConfig: Required<DPProxyConfig>;
  logtoConfig: LogtoManagementConfig;
  m2mSdksConfig: M2MSdksConfig;
}): Promise<void> {
  const { logger, pool, dpProxyConfig, logtoConfig, m2mSdksConfig } = params;
  logger.info({ message: "Executing lifecycle task..." });
  let taskStatusManager: ReturnType<typeof createTaskStatusManager> | undefined;
  let taskToProcess: LifecycleTask | null = null;

  try {
    // Atomically claim the next task AND flip it to `processing` in one
    // statement. This is what makes running multiple worker replicas safe:
    // FOR UPDATE SKIP LOCKED guarantees no two workers claim the same row.
    taskToProcess = await claimNextTask({
      pool,
      maxRetryCount: MAX_RETRY_COUNT,
      cooldownPeriodSeconds: COOLDOWN_PERIOD_SECONDS,
      taskTypes: TASK_TYPES_TO_SEARCH_FOR,
    });

    if (!taskToProcess) {
      logger.info({ message: "No lifecycle task to process at this time." });
      return;
    }
    logger.info(
      { taskId: taskToProcess.id, taskType: taskToProcess.task_type },
      "Claimed lifecycle task, starting processing",
    );

    // The task is already `processing` (set atomically during the claim); the
    // manager is only used from here on to mark completion/failure.
    taskStatusManager = createTaskStatusManager({
      pool,
      maxRetryCount: MAX_RETRY_COUNT,
      task: taskToProcess,
    });

    // Build clients
    const dpProxyClient = new DPProxyClient({
      baseUrl: dpProxyConfig.DP_PROXY_API_BASE_URL,
      getToken: () => dpProxyConfig.DP_PROXY_WEBHOOK_ACCESS_TOKEN,
    });
    const logtoClient = await buildLogtoClient(logtoConfig);
    const auditCollector = getAuditCollectorSdk(m2mSdksConfig, logger);
    const auditLogger = new AuditLogger(
      auditCollector,
      {
        user_id: taskToProcess.profile_id,
        client_timestamp: new Date().toISOString(),
        metadata: { lifecycle_task_id: taskToProcess.id },
      },
      logger.child({
        lifecycle_task_id: taskToProcess.id,
        task_type: taskToProcess.task_type,
        log_reason: "Audit Logger",
      }),
    );
    // Process the task
    const processResult = await processTask(
      pool,
      taskToProcess,
      logger,
      dpProxyClient,
      logtoClient,
      auditLogger,
      m2mSdksConfig,
    );

    if (!processResult.success) {
      logger.error(
        {
          error: processResult.error,
          taskId: taskToProcess?.id,
          taskType: taskToProcess?.task_type,
        },
        "Error processing task",
      );
      await taskStatusManager.setPendingOrFailed(
        processResult instanceof Error
          ? processResult.message
          : String(processResult.error),
      );
      return;
    }

    await taskStatusManager.markAsCompleted(processResult.value);
  } catch (error) {
    if (taskStatusManager) {
      logger.error(
        {
          error,
          taskId: taskToProcess?.id || "Not Found",
          taskType: taskToProcess?.task_type || "Not Found",
        },
        "Error executing lifecycle task",
      );
      await taskStatusManager.setPendingOrFailed(
        error instanceof Error ? error.message : String(error),
      );
    } else {
      logger.error(
        {
          error,
          taskId: taskToProcess?.id || "Not Found",
          taskType: taskToProcess?.task_type || "Not Found",
        },
        "Error occurred before task status manager could be initialized",
      );
    }

    return;
  }

  logger.info({ message: "Lifecycle task completed" });
}

/**
 * Process a lifecycle task based on its type.
 * Throws an error if the task type is not supported.
 */
async function processTask(
  pool: Pool,
  task: LifecycleTask,
  logger: pino.Logger,
  dpProxyClient: DPProxyClient,
  logtoClient: LogtoClient,
  auditLogger: AuditLogger<"user_id" | "client_timestamp" | "metadata">,
  m2mSdksConfig: M2MSdksConfig,
): AsyncTask {
  switch (task.task_type) {
    case LifecycleTaskTypes.DeleteProfile:
      return executeDeleteProfileSteps({
        pool,
        task,
        logger,
        dpProxyClient,
        logtoClient,
        auditLogger,
      });
    case LifecycleTaskTypes.ExportUserData:
      return exportUserDataSdk({
        profileId: task.profile_id,
        auditLogger,
        logger,
        m2mConfig: m2mSdksConfig,
        pool,
        notifyUser: shouldNotifyRequester(task),
      });

    default: {
      // `task` itself narrows to `never` here: typebox@1 preserves the
      // discriminated union, so the switch is provably exhaustive.
      const exhaustiveCheck: never = task;
      throw new Error(
        `Unknown lifecycle task type: ${(exhaustiveCheck as LifecycleTask).task_type}`,
      );
    }
  }
}
