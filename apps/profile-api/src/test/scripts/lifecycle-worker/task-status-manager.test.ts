import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type LifecycleTask,
  LifecycleTaskStatuses,
  LifecycleTaskTypes,
} from "~/schemas/data-lifecycle-tasks/index.js";
import { createTaskStatusManager } from "~/scripts/lifecycle-worker/task-status-manager.js";
import { createLifecycleTask } from "~/services/data-lifecycle-tasks/create-task.js";
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

describe("Task status manager", () => {
  const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
  let client: PoolClient;
  const maxRetryCount = 3;

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

  it("should set status to Processing", async () => {
    await runTestInTransaction(async (txClient) => {
      const mockProfile = getMockProfile();
      const profileId = await createProfile(txClient, mockProfile);
      const now = new Date();

      const { id } = await createLifecycleTask({
        client: txClient,
        lifecycleTaskInput: {
          task_type: LifecycleTaskTypes.DeleteProfile,
          profile_id: profileId,
          scheduled_at: now.toISOString(),
          metadata: {},
          requester_application_id: null,
          requester_user_id: null,
        },
      });

      const taskFromDb = await txClient.query<LifecycleTask>(
        "SELECT * FROM data_lifecycle_tasks WHERE id = $1",
        [id],
      );

      const task = taskFromDb.rows[0];
      const manager = createTaskStatusManager({
        client: txClient,
        maxRetryCount,
        task,
      });

      await manager.startProcessing();

      const updatedTask = await txClient.query<LifecycleTask>(
        "SELECT * FROM data_lifecycle_tasks WHERE id = $1",
        [id],
      );

      expect(updatedTask.rows[0].status).toBe(LifecycleTaskStatuses.Processing);
    });
  });

  it("should set status to Completed and increment retry count", async () => {
    await runTestInTransaction(async (txClient) => {
      const mockProfile = getMockProfile();
      const profileId = await createProfile(txClient, mockProfile);
      const now = new Date();

      const { id } = await createLifecycleTask({
        client: txClient,
        lifecycleTaskInput: {
          task_type: LifecycleTaskTypes.DeleteProfile,
          profile_id: profileId,
          scheduled_at: now.toISOString(),
          metadata: {},
          requester_application_id: null,
          requester_user_id: null,
        },
      });

      const taskFromDb = await txClient.query<LifecycleTask>(
        "SELECT * FROM data_lifecycle_tasks WHERE id = $1",
        [id],
      );

      const task = taskFromDb.rows[0];
      const manager = createTaskStatusManager({
        client: txClient,
        maxRetryCount,
        task,
      });

      await manager.markAsCompleted();

      const updatedTask = await txClient.query<LifecycleTask>(
        "SELECT * FROM data_lifecycle_tasks WHERE id = $1",
        [id],
      );

      expect(updatedTask.rows[0].status).toBe(LifecycleTaskStatuses.Completed);
      expect(updatedTask.rows[0].retry_count).toBe(1);
    });
  });

  it("should set status to Pending when retry count is below max", async () => {
    await runTestInTransaction(async (txClient) => {
      const mockProfile = getMockProfile();
      const profileId = await createProfile(txClient, mockProfile);
      const now = new Date();

      const { id } = await createLifecycleTask({
        client: txClient,
        lifecycleTaskInput: {
          task_type: LifecycleTaskTypes.DeleteProfile,
          profile_id: profileId,
          scheduled_at: now.toISOString(),
          metadata: {},
          requester_application_id: null,
          requester_user_id: null,
        },
      });

      const taskFromDb = await txClient.query<LifecycleTask>(
        "SELECT * FROM data_lifecycle_tasks WHERE id = $1",
        [id],
      );

      const task = taskFromDb.rows[0];
      const manager = createTaskStatusManager({
        client: txClient,
        maxRetryCount: 5,
        task,
      });

      const newStatus = await manager.setPendingOrFailed("Some error occurred");

      expect(newStatus).toBe(LifecycleTaskStatuses.Pending);

      const updatedTask = await txClient.query<LifecycleTask>(
        "SELECT * FROM data_lifecycle_tasks WHERE id = $1",
        [id],
      );

      expect(updatedTask.rows[0].status).toBe(LifecycleTaskStatuses.Pending);
      expect(updatedTask.rows[0].error).toBe("Some error occurred");
      expect(updatedTask.rows[0].retry_count).toBe(1);
    });
  });

  it("should set status to Failed when retry count reaches max", async () => {
    await runTestInTransaction(async (txClient) => {
      const mockProfile = getMockProfile();
      const profileId = await createProfile(txClient, mockProfile);
      const now = new Date();

      const { id } = await createLifecycleTask({
        client: txClient,
        lifecycleTaskInput: {
          task_type: LifecycleTaskTypes.DeleteProfile,
          profile_id: profileId,
          scheduled_at: now.toISOString(),
          metadata: {},
          requester_application_id: null,
          requester_user_id: null,
        },
      });

      await txClient.query(
        `UPDATE data_lifecycle_tasks
         SET retry_count = $1
         WHERE id = $2`,
        [maxRetryCount - 1, id],
      );

      const taskFromDb = await txClient.query<LifecycleTask>(
        "SELECT * FROM data_lifecycle_tasks WHERE id = $1",
        [id],
      );

      const task = taskFromDb.rows[0];
      const manager = createTaskStatusManager({
        client: txClient,
        maxRetryCount,
        task,
      });

      const newStatus = await manager.setPendingOrFailed("Max retries reached");

      expect(newStatus).toBe(LifecycleTaskStatuses.Failed);

      const updatedTask = await txClient.query<LifecycleTask>(
        "SELECT * FROM data_lifecycle_tasks WHERE id = $1",
        [id],
      );

      expect(updatedTask.rows[0].status).toBe(LifecycleTaskStatuses.Failed);
      expect(updatedTask.rows[0].error).toBe("Max retries reached");
      expect(updatedTask.rows[0].retry_count).toBe(maxRetryCount);
    });
  });

  it("should set status to Failed when invoking markAsFailed", async () => {
    await runTestInTransaction(async (txClient) => {
      const mockProfile = getMockProfile();
      const profileId = await createProfile(txClient, mockProfile);
      const now = new Date();

      const { id } = await createLifecycleTask({
        client: txClient,
        lifecycleTaskInput: {
          task_type: LifecycleTaskTypes.DeleteProfile,
          profile_id: profileId,
          scheduled_at: now.toISOString(),
          metadata: {},
          requester_application_id: null,
          requester_user_id: null,
        },
      });

      const taskFromDb = await txClient.query<LifecycleTask>(
        "SELECT * FROM data_lifecycle_tasks WHERE id = $1",
        [id],
      );

      const task = taskFromDb.rows[0];
      const manager = createTaskStatusManager({
        client: txClient,
        maxRetryCount,
        task,
      });

      await manager.markAsFailed("Profile deletion failed");

      const updatedTask = await txClient.query<LifecycleTask>(
        "SELECT * FROM data_lifecycle_tasks WHERE id = $1",
        [id],
      );

      expect(updatedTask.rows[0].status).toBe(LifecycleTaskStatuses.Failed);
      expect(updatedTask.rows[0].error).toBe("Profile deletion failed");
    });
  });

  it("should set error message when provided in setPendingOrFailed", async () => {
    await runTestInTransaction(async (txClient) => {
      const mockProfile = getMockProfile();
      const profileId = await createProfile(txClient, mockProfile);
      const now = new Date();

      const { id } = await createLifecycleTask({
        client: txClient,
        lifecycleTaskInput: {
          task_type: LifecycleTaskTypes.DeleteProfile,
          profile_id: profileId,
          scheduled_at: now.toISOString(),
          metadata: {},
          requester_application_id: null,
          requester_user_id: null,
        },
      });

      const taskFromDb = await txClient.query<LifecycleTask>(
        "SELECT * FROM data_lifecycle_tasks WHERE id = $1",
        [id],
      );

      const task = taskFromDb.rows[0];
      const manager = createTaskStatusManager({
        client: txClient,
        maxRetryCount,
        task,
      });

      const errorMessage = "Connection timeout while processing profile";
      await manager.setPendingOrFailed(errorMessage);

      const updatedTask = await txClient.query<LifecycleTask>(
        "SELECT * FROM data_lifecycle_tasks WHERE id = $1",
        [id],
      );

      expect(updatedTask.rows[0].error).toBe(errorMessage);
    });
  });

  it("should clear error when no error is provided in setPendingOrFailed", async () => {
    await runTestInTransaction(async (txClient) => {
      const mockProfile = getMockProfile();
      const profileId = await createProfile(txClient, mockProfile);
      const now = new Date();

      const { id } = await createLifecycleTask({
        client: txClient,
        lifecycleTaskInput: {
          task_type: LifecycleTaskTypes.DeleteProfile,
          profile_id: profileId,
          scheduled_at: now.toISOString(),
          metadata: {},
          requester_application_id: null,
          requester_user_id: null,
        },
      });

      await txClient.query(
        `UPDATE data_lifecycle_tasks
         SET error = $1
         WHERE id = $2`,
        ["Initial error", id],
      );

      const taskFromDb = await txClient.query<LifecycleTask>(
        "SELECT * FROM data_lifecycle_tasks WHERE id = $1",
        [id],
      );

      const task = taskFromDb.rows[0];
      const manager = createTaskStatusManager({
        client: txClient,
        maxRetryCount,
        task,
      });

      await manager.setPendingOrFailed();

      const updatedTask = await txClient.query<LifecycleTask>(
        "SELECT * FROM data_lifecycle_tasks WHERE id = $1",
        [id],
      );

      expect(updatedTask.rows[0].error).toBeNull();
    });
  });
});
