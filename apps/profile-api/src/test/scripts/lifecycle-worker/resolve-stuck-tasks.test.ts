import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import pino from "pino";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type LifecycleTask,
  LifecycleTaskStatuses,
  LifecycleTaskTypes,
} from "~/schemas/data-lifecycle-tasks/index.js";
import { resolveStuckTasks } from "~/scripts/lifecycle-worker/resolve-stuck-tasks.js";
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

describe("Resolve Stuck Tasks", () => {
  const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
  let client: PoolClient;
  const _maxRetryCount = 3;
  _maxRetryCount;
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

  it("should ignore task if it is not stuck", async () => {
    await runTestInTransaction(async (txClient) => {
      const mockProfile = getMockProfile();
      const profileId = await createProfile(txClient, mockProfile);
      const now = new Date();

      await createLifecycleTask({
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

      const { id: secondId } = await createLifecycleTask({
        client: txClient,
        lifecycleTaskInput: {
          task_type: LifecycleTaskTypes.ExportUserData,
          profile_id: profileId,
          scheduled_at: now.toISOString(),
          metadata: {},
          requester_application_id: null,
          requester_user_id: null,
        },
      });

      // Maintain the first task in Pending status to simulate a new one
      // and the second task in Processing status to simulate it being worked on (but not stuck yet)
      await txClient.query<LifecycleTask>(
        "UPDATE data_lifecycle_tasks SET status = $1 WHERE id = $2",
        [LifecycleTaskStatuses.Processing, secondId],
      );

      const stucks = await resolveStuckTasks({
        client: txClient,
        logger: pino.pino({ level: "silent" }),
        isStuckAfterMinutes: 10,
      });

      expect(Object.keys(stucks).length).toBe(0);
    });
  });

  it("should set task to failed if it is stuck and already retried max times", async () => {
    await runTestInTransaction(async (txClient) => {
      const mockProfile = getMockProfile();
      const profileId = await createProfile(txClient, mockProfile);
      const now = new Date();

      const { id: taskId } = await createLifecycleTask({
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

      const updatedAt = new Date(Date.now() - 100 * 60 * 1000); // 100 minutes ago
      await txClient.query<LifecycleTask>(
        `UPDATE data_lifecycle_tasks 
            SET status = $1, 
            retry_count = $2,
            updated_at = $3
         WHERE id = $4`,
        [LifecycleTaskStatuses.Processing, 2, updatedAt, taskId],
      );

      const stucks = await resolveStuckTasks({
        client: txClient,
        logger: pino.pino({ level: "silent" }),
        isStuckAfterMinutes: 10,
      });

      expect(Object.keys(stucks).length).toBe(1);
      expect(stucks[taskId]).toBe(LifecycleTaskStatuses.Failed);
    });
  });

  it("should set task to pending if it is stuck and has not retried max times", async () => {
    await runTestInTransaction(async (txClient) => {
      const mockProfile = getMockProfile();
      const profileId = await createProfile(txClient, mockProfile);
      const now = new Date();

      const { id: taskId } = await createLifecycleTask({
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

      const updatedAt = new Date(Date.now() - 100 * 60 * 1000); // 100 minutes ago
      await txClient.query<LifecycleTask>(
        `UPDATE data_lifecycle_tasks 
            SET status = $1, 
            retry_count = $2,
            updated_at = $3
         WHERE id = $4 RETURNING *`,
        [LifecycleTaskStatuses.Processing, 0, updatedAt, taskId],
      );

      const stucks = await resolveStuckTasks({
        client: txClient,
        logger: pino.pino({ level: "silent" }),
        isStuckAfterMinutes: 10,
      });

      expect(Object.keys(stucks).length).toBe(1);
      expect(stucks[taskId]).toBe(LifecycleTaskStatuses.Pending);
    });
  });
});
