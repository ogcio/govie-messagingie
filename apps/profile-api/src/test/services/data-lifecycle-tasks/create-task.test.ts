import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type LifecycleTask,
  LifecycleTaskStatuses,
  LifecycleTaskTypes,
} from "~/schemas/data-lifecycle-tasks/index.js";
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

describe("Create data lifecycle task", () => {
  const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
  let client: PoolClient;

  beforeAll(async () => {
    client = await pool.connect();
  });

  afterAll(async () => {
    client.release();
    if (!pool.ended) {
      await pool.end();
    }
  });

  it("should correctly create a data lifecycle task", async () => {
    const mockProfile = getMockProfile();
    const profileId = await createProfile(client, mockProfile);
    const now = new Date();
    const isoNow = now.toISOString();

    const { id } = await createLifecycleTask({
      client,
      lifecycleTaskInput: {
        task_type: LifecycleTaskTypes.DeleteProfile,
        profile_id: profileId,
        scheduled_at: isoNow,
        metadata: { test: "value", requested_by_user_id: profileId },
      },
    });

    expect(id).toBeDefined();

    const taskFromDb = await client.query<LifecycleTask>(
      "SELECT * FROM data_lifecycle_tasks WHERE id = $1",
      [id],
    );

    expect(taskFromDb.rows.length).toBe(1);
    expect(taskFromDb.rows[0].id).toBe(id);
    expect(taskFromDb.rows[0].profile_id).toBe(profileId);
    expect(taskFromDb.rows[0].task_type).toBe(LifecycleTaskTypes.DeleteProfile);
    expect(taskFromDb.rows[0].status).toBe(LifecycleTaskStatuses.Pending);
    expect(taskFromDb.rows[0].retry_count).toBe(0);
    expect(taskFromDb.rows[0].error).toBeNull();
    expect(taskFromDb.rows[0].created_at).toBeDefined();
    expect(taskFromDb.rows[0].updated_at).toBeDefined();
    expect(taskFromDb.rows[0].scheduled_at).toBeDefined();
    expect(taskFromDb.rows[0].metadata).toEqual({
      test: "value",
      requested_by_user_id: profileId,
    });
    expect(taskFromDb.rows[0].scheduled_at).toStrictEqual(now);
  });
});
