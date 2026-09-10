import type { Pool } from "pg";
import pino from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DPProxyConfig,
  LogtoManagementConfig,
  M2MSdksConfig,
} from "~/plugins/external/env.js";
import { LifecycleTaskTypes } from "~/schemas/data-lifecycle-tasks/index.js";

const claimNextTask = vi.fn();
vi.mock("~/services/data-lifecycle-tasks/get-task-to-process.js", () => ({
  claimNextTask: (...args: unknown[]) => claimNextTask(...args),
}));

const setPendingOrFailed = vi.fn();
const markAsCompleted = vi.fn();
const createTaskStatusManager = vi.fn((..._args: unknown[]) => ({
  setPendingOrFailed,
  markAsCompleted,
}));
vi.mock("~/scripts/lifecycle-worker/task-status-manager.js", () => ({
  createTaskStatusManager: (...args: unknown[]) =>
    createTaskStatusManager(...args),
}));

vi.mock("~/clients/logto.js", () => ({
  buildLogtoClient: vi.fn().mockResolvedValue({ kind: "logto" }),
}));

vi.mock("~/utils/authentication-factory.js", () => ({
  getAuditCollectorSdk: vi.fn(() => ({ createEvents: vi.fn() })),
}));

const executeDeleteProfileSteps = vi.fn();
vi.mock("~/scripts/lifecycle-worker/steps/delete-profile.js", () => ({
  executeDeleteProfileSteps: (...args: unknown[]) =>
    executeDeleteProfileSteps(...args),
}));

const exportUserDataSdk = vi.fn();
vi.mock("~/scripts/lifecycle-worker/steps/export-user-data/index.js", () => ({
  exportUserDataSdk: (...args: unknown[]) => exportUserDataSdk(...args),
}));

vi.mock("~/utils/audit-logger.js", () => ({
  AuditLogger: class {
    safeSendLogs = vi.fn();
  },
}));

import { executeTask } from "~/scripts/lifecycle-worker/execute-task.js";

const logger = pino({ enabled: false });
const pool = {} as Pool;
const baseParams = {
  logger,
  pool,
  dpProxyConfig: {
    DP_PROXY_API_BASE_URL: "https://dp.example",
    DP_PROXY_WEBHOOK_ACCESS_TOKEN: "token",
  } as Required<DPProxyConfig>,
  logtoConfig: {} as LogtoManagementConfig,
  m2mSdksConfig: {} as M2MSdksConfig,
};

const buildTask = (taskType: string, retryCount = 0) => ({
  id: "task-1",
  task_type: taskType,
  profile_id: "profile-1",
  status: "processing",
  retry_count: retryCount,
  requester_application_id: null,
  requester_user_id: "profile-1",
  metadata: {},
});

describe("executeTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns early when there is no task to claim", async () => {
    claimNextTask.mockResolvedValue(null);

    await executeTask(baseParams);

    expect(createTaskStatusManager).not.toHaveBeenCalled();
    expect(executeDeleteProfileSteps).not.toHaveBeenCalled();
    expect(exportUserDataSdk).not.toHaveBeenCalled();
  });

  it("processes a delete-profile task and marks it completed", async () => {
    claimNextTask.mockResolvedValue(
      buildTask(LifecycleTaskTypes.DeleteProfile),
    );
    executeDeleteProfileSteps.mockResolvedValue({
      success: true,
      value: { deleted: true },
    });

    await executeTask(baseParams);

    expect(executeDeleteProfileSteps).toHaveBeenCalledTimes(1);
    expect(markAsCompleted).toHaveBeenCalledWith({ deleted: true });
    expect(setPendingOrFailed).not.toHaveBeenCalled();
  });

  it("processes an export task honoring the notify flag", async () => {
    claimNextTask.mockResolvedValue(
      buildTask(LifecycleTaskTypes.ExportUserData),
    );
    exportUserDataSdk.mockResolvedValue({
      success: true,
      value: { uploadId: "up-1" },
    });

    await executeTask(baseParams);

    expect(exportUserDataSdk).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: "profile-1", notifyUser: true }),
    );
    expect(markAsCompleted).toHaveBeenCalledWith({ uploadId: "up-1" });
  });

  it("does not notify when the export was requested by an application", async () => {
    claimNextTask.mockResolvedValue({
      ...buildTask(LifecycleTaskTypes.ExportUserData),
      requester_application_id: "app-1",
    });
    exportUserDataSdk.mockResolvedValue({ success: true, value: {} });

    await executeTask(baseParams);

    expect(exportUserDataSdk).toHaveBeenCalledWith(
      expect.objectContaining({ notifyUser: false }),
    );
  });

  it("sets the task pending/failed when processing reports a failure", async () => {
    claimNextTask.mockResolvedValue(
      buildTask(LifecycleTaskTypes.DeleteProfile),
    );
    executeDeleteProfileSteps.mockResolvedValue({
      success: false,
      error: new Error("boom"),
    });

    await executeTask(baseParams);

    // The failure branch stringifies the result's error object.
    expect(setPendingOrFailed).toHaveBeenCalledWith("Error: boom");
    expect(markAsCompleted).not.toHaveBeenCalled();
  });

  it("sets the task pending/failed when processing throws", async () => {
    claimNextTask.mockResolvedValue(
      buildTask(LifecycleTaskTypes.DeleteProfile),
    );
    executeDeleteProfileSteps.mockRejectedValue(new Error("exploded"));

    await executeTask(baseParams);

    expect(setPendingOrFailed).toHaveBeenCalledWith("exploded");
  });

  it("stringifies non-Error throwables when marking the failure", async () => {
    claimNextTask.mockResolvedValue(
      buildTask(LifecycleTaskTypes.DeleteProfile),
    );
    executeDeleteProfileSteps.mockRejectedValue("string failure");

    await executeTask(baseParams);

    expect(setPendingOrFailed).toHaveBeenCalledWith("string failure");
  });

  it("swallows errors thrown before the status manager exists", async () => {
    claimNextTask.mockRejectedValue(new Error("claim failed"));

    await expect(executeTask(baseParams)).resolves.toBeUndefined();
    expect(setPendingOrFailed).not.toHaveBeenCalled();
  });

  it("fails an unknown task type via the status manager", async () => {
    claimNextTask.mockResolvedValue(buildTask("not_a_real_type"));

    await executeTask(baseParams);

    expect(setPendingOrFailed).toHaveBeenCalledWith(
      expect.stringContaining("Unknown lifecycle task type"),
    );
  });
});
