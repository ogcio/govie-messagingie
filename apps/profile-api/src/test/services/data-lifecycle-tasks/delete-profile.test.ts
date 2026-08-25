import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LifecycleTaskTypes } from "~/schemas/data-lifecycle-tasks/index.js";
import { ProfileStatuses } from "~/schemas/profiles/model.js";
import { createDeleteProfileTask } from "~/services/data-lifecycle-tasks/create-delete-profile-task.js";
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

describe("Delete profile", () => {
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

  it("should return error for an already disabled profile", async () => {
    const mockProfile = getMockProfile();
    const profileId = await createProfile(client, mockProfile);

    await client.query("UPDATE profiles SET status = $1 WHERE id = $2", [
      ProfileStatuses.Disabled,
      mockProfile.id,
    ]);

    await expect(
      createDeleteProfileTask({
        pool,
        toDeleteProfileId: profileId,
        requesterUserId: profileId,
        requesterApplicationId: null,
      }),
    ).rejects.toThrowError(
      /Profile is already planned for deletion or disabled/,
    );

    const { rows: parentRows } = await client.query(
      "SELECT status FROM profiles WHERE id = $1",
      [mockProfile.id],
    );

    // Status should remain Disabled
    expect(parentRows[0].status).toBe(ProfileStatuses.Disabled);

    //should create no tasks
    const { rows: taskRows } = await client.query(
      "SELECT * FROM data_lifecycle_tasks WHERE profile_id = $1",
      [mockProfile.id],
    );
    expect(taskRows.length).toBe(0);
  });

  it("should return error for an already deleted profile", async () => {
    const mockProfile = getMockProfile();
    const profileId = await createProfile(client, mockProfile);

    await client.query("UPDATE profiles SET status = $1 WHERE id = $2", [
      ProfileStatuses.Deleted,
      mockProfile.id,
    ]);

    await expect(
      createDeleteProfileTask({
        pool,
        toDeleteProfileId: profileId,
        requesterUserId: profileId,
        requesterApplicationId: null,
      }),
    ).rejects.toThrowError(
      /Profile is already planned for deletion or disabled/,
    );

    const { rows: parentRows } = await client.query(
      "SELECT status FROM profiles WHERE id = $1",
      [mockProfile.id],
    );

    // Status should remain Deleted
    expect(parentRows[0].status).toBe(ProfileStatuses.Deleted);

    //should create no tasks
    const { rows: taskRows } = await client.query(
      "SELECT * FROM data_lifecycle_tasks WHERE profile_id = $1",
      [mockProfile.id],
    );
    expect(taskRows.length).toBe(0);
  });

  it("should return error for a child profile", async () => {
    const parentProfile = getMockProfile();
    const parentProfileId = await createProfile(client, parentProfile);
    const childProfile = getMockProfile();
    childProfile.primaryUserId = parentProfileId;
    const profileId = await createProfile(client, childProfile);

    await expect(
      createDeleteProfileTask({
        pool,
        toDeleteProfileId: profileId,
        requesterUserId: profileId,
        requesterApplicationId: null,
      }),
    ).rejects.toThrowError(/Only primary profiles can be deleted/);

    const { rows: parentRows } = await client.query(
      "SELECT status FROM profiles WHERE id in ($1, $2)",
      [parentProfileId, profileId],
    );

    // Statuses should remain Active
    expect(parentRows[0].status).toBe(ProfileStatuses.Active);
    expect(parentRows[1].status).toBe(ProfileStatuses.Active);

    //should create no tasks
    const { rows: taskRows } = await client.query(
      "SELECT * FROM data_lifecycle_tasks WHERE profile_id in ($1, $2)",
      [parentProfileId, profileId],
    );

    expect(taskRows.length).toBe(0);
  });

  it("should update status for an active user with no links ", async () => {
    const mockProfile = getMockProfile();
    const profileId = await createProfile(client, mockProfile);
    const _requestedBy = randomUUID().substring(0, 12);
    const m2mApplicationId = randomUUID().substring(0, 15);
    const superAdminUserId = randomUUID().substring(0, 12);

    await createDeleteProfileTask({
      pool,
      toDeleteProfileId: profileId,
      requesterApplicationId: m2mApplicationId,
      requesterUserId: superAdminUserId,
    });

    const { rows } = await client.query(
      "SELECT status FROM profiles WHERE id = $1",
      [profileId],
    );

    expect(rows[0].status).toBe(ProfileStatuses.Disabled);

    //should create a task
    const { rows: taskRows } = await client.query(
      "SELECT * FROM data_lifecycle_tasks WHERE profile_id = $1 and task_type = $2",
      [profileId, LifecycleTaskTypes.DeleteProfile],
    );

    expect(taskRows.length).toBe(1);
    expect(taskRows[0].requester_user_id).toBe(superAdminUserId);
    expect(taskRows[0].requester_application_id).toBe(m2mApplicationId);
  });

  it("should update status for an active primary profile", async () => {
    const parentProfile = getMockProfile();
    const parentProfileId = await createProfile(client, parentProfile);
    const requestedBy = randomUUID().substring(0, 12);
    const childProfile = getMockProfile();
    childProfile.primaryUserId = parentProfileId;
    const profileId = await createProfile(client, childProfile);

    await createDeleteProfileTask({
      pool,
      toDeleteProfileId: parentProfileId,
      requesterApplicationId: null,
      requesterUserId: requestedBy,
    });

    const { rows: parentRows } = await client.query(
      "SELECT status FROM profiles WHERE id in ($1, $2)",
      [parentProfileId, profileId],
    );

    expect(parentRows[0].status).toBe(ProfileStatuses.Disabled);
    expect(parentRows[1].status).toBe(ProfileStatuses.Disabled);

    //should create a task for the parent only
    const { rows: taskRows } = await client.query(
      "SELECT * FROM data_lifecycle_tasks WHERE profile_id = $1 and task_type = $2",
      [parentProfileId, LifecycleTaskTypes.DeleteProfile],
    );

    expect(taskRows.length).toBe(1);
  });
});
