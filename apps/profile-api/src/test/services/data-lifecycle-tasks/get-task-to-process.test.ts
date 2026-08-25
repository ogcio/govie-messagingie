import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type LifecycleTaskInput,
  LifecycleTaskStatuses,
  type LifecycleTaskType,
  LifecycleTaskTypes,
} from "~/schemas/data-lifecycle-tasks/index.js";
import { shouldNotifyRequester } from "~/scripts/lifecycle-worker/steps/export-user-data/notify.js";
import { createLifecycleTask } from "~/services/data-lifecycle-tasks/create-task.js";
import {
  claimNextTask,
  getPendingTask,
} from "~/services/data-lifecycle-tasks/get-task-to-process.js";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";

const getMockProfile = () => {
  const id = randomUUID().substring(0, 12);
  return {
    id,
    primaryUserId: id,
    publicName: randomUUID().substring(0, 13),
    firstName: randomUUID().substring(0, 10),
    lastName: randomUUID().substring(0, 10),
    email: `${randomUUID().substring(0, 10)}@example.com`,
  };
};

describe("Get task to process", () => {
  const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
  let client: PoolClient;
  const maxRetryCount = 3;
  const cooldownPeriodSeconds = 60;

  beforeAll(async () => {
    client = await pool.connect();
  });

  afterAll(async () => {
    client.release();
    if (!pool.ended) {
      await pool.end();
    }
  });

  // Wrap each test in a transaction that rolls back to ensure test isolation
  const runTestInTransaction = async (
    testFn: (client: PoolClient) => Promise<void>,
  ) => {
    await client.query("BEGIN");
    try {
      await testFn(client);
    } finally {
      await client.query("ROLLBACK");
    }
  };

  it("should return a pending task that is scheduled to run now or in the past", async () => {
    await runTestInTransaction(async (txClient) => {
      const taskType = randomUUID() as LifecycleTaskType;
      const mockProfile = getMockProfile();
      const profileId = await createProfile(txClient, mockProfile);
      const pastDate = new Date(Date.now() - 10000); // 10 seconds ago

      await createLifecycleTask({
        client: txClient,
        lifecycleTaskInput: {
          task_type: taskType,
          profile_id: profileId,
          scheduled_at: pastDate.toISOString(),
          metadata: {},
        } as LifecycleTaskInput,
      });

      const task = await getPendingTask({
        client: txClient,
        maxRetryCount,
        cooldownPeriodSeconds,
        taskTypes: [taskType],
      });

      expect(task).not.toBeNull();
      expect(task?.profile_id).toBe(profileId);
      expect(task?.status).toBe(LifecycleTaskStatuses.Pending);
      expect(task?.task_type).toBe(taskType);
    });
  });

  it("should not return a pending task that for another type", async () => {
    await runTestInTransaction(async (txClient) => {
      const taskType = randomUUID() as LifecycleTaskType;
      const mockProfile = getMockProfile();
      const profileId = await createProfile(txClient, mockProfile);
      const pastDate = new Date(Date.now() - 10000); // 10 seconds ago

      await createLifecycleTask({
        client: txClient,
        lifecycleTaskInput: {
          task_type: taskType,
          profile_id: profileId,
          scheduled_at: pastDate.toISOString(),
          metadata: {},
        } as LifecycleTaskInput,
      });

      const task = await getPendingTask({
        client: txClient,
        maxRetryCount,
        cooldownPeriodSeconds,
        taskTypes: ["another-type" as LifecycleTaskType],
      });

      expect(task).toBeNull();
    });
  });

  it("should not return a failed task", async () => {
    await runTestInTransaction(async (txClient) => {
      const taskType = randomUUID() as LifecycleTaskType;
      const mockProfile = getMockProfile();
      const profileId = await createProfile(txClient, mockProfile);
      const pastDate = new Date(Date.now() - 10000); // 10 seconds ago

      const { id } = await createLifecycleTask({
        client: txClient,
        lifecycleTaskInput: {
          task_type: taskType,
          profile_id: profileId,
          scheduled_at: pastDate.toISOString(),
          metadata: {},
        } as LifecycleTaskInput,
      });

      // Set status to Failed
      await txClient.query(
        `UPDATE data_lifecycle_tasks
         SET status = $1, updated_at = NOW() - interval '1 hour'
         WHERE id = $2`,
        [LifecycleTaskStatuses.Failed, id],
      );

      const task = await getPendingTask({
        client: txClient,
        maxRetryCount,
        cooldownPeriodSeconds,
        taskTypes: [taskType],
      });

      expect(task).toBeNull();
    });
  });

  it("should not return a processing task", async () => {
    await runTestInTransaction(async (txClient) => {
      const taskType = randomUUID() as LifecycleTaskType;
      const mockProfile = getMockProfile();
      const profileId = await createProfile(txClient, mockProfile);
      const pastDate = new Date(Date.now() - 10000); // 10 seconds ago

      const { id } = await createLifecycleTask({
        client: txClient,
        lifecycleTaskInput: {
          task_type: taskType,
          profile_id: profileId,
          scheduled_at: pastDate.toISOString(),
          metadata: {},
        } as LifecycleTaskInput,
      });

      // Set status to Processing
      await txClient.query(
        `UPDATE data_lifecycle_tasks
         SET status = $1, updated_at = NOW() - interval '1 hour'
         WHERE id = $2`,
        [LifecycleTaskStatuses.Processing, id],
      );

      const task = await getPendingTask({
        client: txClient,
        maxRetryCount,
        cooldownPeriodSeconds,
        taskTypes: [taskType],
      });

      expect(task).toBeNull();
    });
  });

  it("should not return a task that is scheduled in the future", async () => {
    await runTestInTransaction(async (txClient) => {
      const taskType = randomUUID() as LifecycleTaskType;
      const mockProfile = getMockProfile();
      const profileId = await createProfile(txClient, mockProfile);
      const futureDate = new Date(Date.now() + 60000); // 60 seconds in the future

      await createLifecycleTask({
        client: txClient,
        lifecycleTaskInput: {
          task_type: taskType,
          profile_id: profileId,
          scheduled_at: futureDate.toISOString(),
          metadata: {},
        } as LifecycleTaskInput,
      });

      const task = await getPendingTask({
        client: txClient,
        maxRetryCount,
        cooldownPeriodSeconds,
        taskTypes: [taskType],
      });

      expect(task).toBeNull();
    });
  });

  it("should not return a task that is still in cooldown period", async () => {
    await runTestInTransaction(async (txClient) => {
      const taskType = randomUUID() as LifecycleTaskType;
      const mockProfile = getMockProfile();
      const profileId = await createProfile(txClient, mockProfile);
      const pastDate = new Date(Date.now() - 10000); // 10 seconds ago

      const { id } = await createLifecycleTask({
        client: txClient,
        lifecycleTaskInput: {
          task_type: taskType,
          profile_id: profileId,
          scheduled_at: pastDate.toISOString(),
          metadata: {},
        } as LifecycleTaskInput,
      });

      // Simulate a recent failure by updating the task
      await txClient.query(
        `UPDATE data_lifecycle_tasks
         SET status = $1, retry_count = retry_count + 1, updated_at = NOW()
         WHERE id = $2`,
        [LifecycleTaskStatuses.Pending, id],
      );

      // Use a large cooldown period so the task is still in cooldown
      const task = await getPendingTask({
        client: txClient,
        maxRetryCount,
        cooldownPeriodSeconds: 3600, // 1 hour cooldown
        taskTypes: [taskType],
      });

      expect(task).toBeNull();
    });
  });

  it("should not return a task that has exceeded max retry count", async () => {
    await runTestInTransaction(async (txClient) => {
      const taskType = randomUUID() as LifecycleTaskType;
      const mockProfile = getMockProfile();
      const profileId = await createProfile(txClient, mockProfile);
      const pastDate = new Date(Date.now() - 10000); // 10 seconds ago

      const { id } = await createLifecycleTask({
        client: txClient,
        lifecycleTaskInput: {
          task_type: taskType,
          profile_id: profileId,
          scheduled_at: pastDate.toISOString(),
          metadata: {},
        } as LifecycleTaskInput,
      });

      // Set retry count to exceed max retry count
      await txClient.query(
        `UPDATE data_lifecycle_tasks
         SET retry_count = $1, updated_at = NOW() - interval '1 hour'
         WHERE id = $2`,
        [maxRetryCount, id],
      );

      const task = await getPendingTask({
        client: txClient,
        maxRetryCount,
        cooldownPeriodSeconds,
        taskTypes: [taskType],
      });

      expect(task).toBeNull();
    });
  });

  it("should return null when no task is available", async () => {
    await runTestInTransaction(async (txClient) => {
      const taskType = randomUUID() as LifecycleTaskType;
      const task = await getPendingTask({
        client: txClient,
        maxRetryCount,
        cooldownPeriodSeconds,
        taskTypes: [taskType],
      });

      // In a transaction with no other tasks, this should return null
      expect(task).toBeNull();
    });
  });

  it("should return the oldest pending task first", async () => {
    await runTestInTransaction(async (txClient) => {
      const mockProfile1 = getMockProfile();
      const profileId1 = await createProfile(txClient, mockProfile1);
      const mockProfile2 = getMockProfile();
      const profileId2 = await createProfile(txClient, mockProfile2);

      const pastDate = new Date(Date.now() - 10000);
      const taskType = randomUUID() as LifecycleTaskType;
      // Create first task (older)
      const { id: id1 } = await createLifecycleTask({
        client: txClient,
        lifecycleTaskInput: {
          task_type: taskType,
          profile_id: profileId1,
          scheduled_at: pastDate.toISOString(),
          metadata: {},
        } as LifecycleTaskInput,
      });

      // Create second task (newer)
      await createLifecycleTask({
        client: txClient,
        lifecycleTaskInput: {
          task_type: taskType,
          profile_id: profileId2,
          scheduled_at: pastDate.toISOString(),
          metadata: {},
        } as LifecycleTaskInput,
      });

      const task = await getPendingTask({
        client: txClient,
        maxRetryCount,
        cooldownPeriodSeconds,
        taskTypes: [taskType],
      });

      expect(task?.id).toBe(id1);
    });
  });
});

// These tests exercise the ATOMIC claim across separate DB connections, so they
// cannot use the shared rollback transaction above (the claimed row must be
// committed to be visible to a second connection). Each test uses a unique
// random task_type as a namespace and cleans up its own committed rows.
describe("claimNextTask (atomic claim)", () => {
  const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
  const maxRetryCount = 3;
  const cooldownPeriodSeconds = 60;
  const createdTaskTypes: LifecycleTaskType[] = [];
  const createdTaskIds: string[] = [];

  afterAll(async () => {
    if (createdTaskTypes.length > 0) {
      await pool.query(
        "DELETE FROM data_lifecycle_tasks WHERE task_type = ANY($1::text[])",
        [createdTaskTypes],
      );
    }
    if (createdTaskIds.length > 0) {
      await pool.query(
        "DELETE FROM data_lifecycle_tasks WHERE id = ANY($1::uuid[])",
        [createdTaskIds],
      );
    }
    if (!pool.ended) {
      await pool.end();
    }
  });

  const seedPendingTask = async (): Promise<{
    taskType: LifecycleTaskType;
    taskId: string;
  }> => {
    const taskType = randomUUID() as LifecycleTaskType;
    createdTaskTypes.push(taskType);
    const client = await pool.connect();
    try {
      const profileId = await createProfile(client, getMockProfile());
      const { id } = await createLifecycleTask({
        client,
        lifecycleTaskInput: {
          task_type: taskType,
          profile_id: profileId,
          scheduled_at: new Date(Date.now() - 10_000).toISOString(),
          metadata: {},
        } as LifecycleTaskInput,
      });
      return { taskType, taskId: id };
    } finally {
      client.release();
    }
  };

  it("claims a pending task and transitions it to processing", async () => {
    const { taskType, taskId } = await seedPendingTask();

    const claimed = await claimNextTask({
      pool,
      maxRetryCount,
      cooldownPeriodSeconds,
      taskTypes: [taskType],
    });

    expect(claimed?.id).toBe(taskId);
    expect(claimed?.status).toBe(LifecycleTaskStatuses.Processing);
  });

  it("does not re-claim a task that is already processing", async () => {
    const { taskType } = await seedPendingTask();

    const first = await claimNextTask({
      pool,
      maxRetryCount,
      cooldownPeriodSeconds,
      taskTypes: [taskType],
    });
    const second = await claimNextTask({
      pool,
      maxRetryCount,
      cooldownPeriodSeconds,
      taskTypes: [taskType],
    });

    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it("lets exactly one of two concurrent claims win the same task", async () => {
    const { taskType, taskId } = await seedPendingTask();

    const claimOnce = () =>
      claimNextTask({
        pool,
        maxRetryCount,
        cooldownPeriodSeconds,
        taskTypes: [taskType],
      });

    const [a, b] = await Promise.all([claimOnce(), claimOnce()]);

    const winners = [a, b].filter((task) => task !== null);
    expect(winners).toHaveLength(1);
    expect(winners[0]?.id).toBe(taskId);
    expect(winners[0]?.status).toBe(LifecycleTaskStatuses.Processing);
  });

  // Regression coverage for the getLifecycleTaskDbFieldsToSelect() column
  // list: it must include requester_user_id and requester_application_id,
  // otherwise the row claimNextTask hands to the worker carries `undefined`
  // for both, and shouldNotifyRequester's `=== null` check silently resolves
  // to `false` for every task, citizen-requested included.
  const seedExportTask = async (params: {
    requesterUserId: string | null;
    requesterApplicationId: string | null;
  }): Promise<{ taskId: string; profileId: string }> => {
    const client = await pool.connect();
    try {
      const profileId = await createProfile(client, getMockProfile());
      const { id } = await createLifecycleTask({
        client,
        lifecycleTaskInput: {
          task_type: LifecycleTaskTypes.ExportUserData,
          profile_id: profileId,
          scheduled_at: new Date(Date.now() - 10_000).toISOString(),
          metadata: {},
          requester_user_id: params.requesterUserId,
          requester_application_id: params.requesterApplicationId,
        },
      });
      createdTaskIds.push(id);
      return { taskId: id, profileId };
    } finally {
      client.release();
    }
  };

  it("claims a citizen-requested export task with the requester columns intact, and shouldNotifyRequester allows the notification", async () => {
    const { taskId, profileId } = await seedExportTask({
      requesterUserId: "citizen-1",
      requesterApplicationId: null,
    });

    const claimed = await claimNextTask({
      pool,
      maxRetryCount,
      cooldownPeriodSeconds,
      taskTypes: [LifecycleTaskTypes.ExportUserData],
      profileId,
    });

    expect(claimed?.id).toBe(taskId);
    expect(claimed?.requester_user_id).toBe("citizen-1");
    expect(claimed?.requester_application_id).toBeNull();
    expect(claimed && shouldNotifyRequester(claimed)).toBe(true);
  });

  it("claims an M2M-requested export task with the requester columns intact, and shouldNotifyRequester suppresses the notification", async () => {
    const { taskId, profileId } = await seedExportTask({
      requesterUserId: "support-agent-1",
      requesterApplicationId: "support-app-1",
    });

    const claimed = await claimNextTask({
      pool,
      maxRetryCount,
      cooldownPeriodSeconds,
      taskTypes: [LifecycleTaskTypes.ExportUserData],
      profileId,
    });

    expect(claimed?.id).toBe(taskId);
    expect(claimed?.requester_user_id).toBe("support-agent-1");
    expect(claimed?.requester_application_id).toBe("support-app-1");
    expect(claimed && shouldNotifyRequester(claimed)).toBe(false);
  });
});
