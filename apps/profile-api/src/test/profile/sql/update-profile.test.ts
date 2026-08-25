import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import { updateProfile } from "~/services/profiles/sql/update-profile.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { mockDbProfiles, mockProfiles } from "~/test/fixtures/common.js";

describe("updateProfile", () => {
  const getSampleProfile = () => ({
    ...mockDbProfiles[0],
    safeLevel: 1,
    id: randomUUID().substring(0, 12),
    email: `${randomUUID().substring(0, 5)}@example.com`,
  });

  const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
  let client: PoolClient;

  beforeEach(async () => {
    client = await pool.connect();
  });

  afterEach(() => {
    if (client) {
      client.release();
    }
  });

  afterAll(async () => {
    if (!pool.ended) {
      await pool.end();
    }
  });

  it("should update profile with all fields", async () => {
    const sampleProfile = getSampleProfile();
    const result = await createProfile(client, sampleProfile);
    const anotherId = randomUUID().substring(0, 12);
    await createProfile(client, {
      ...sampleProfile,
      id: anotherId,
      email: `${randomUUID().substring(0, 10)}@example.com`,
    });
    const updateValues = {
      publicName: `${randomUUID().substring(0, 12)} ${randomUUID().substring(0, 12)}`,
      email: `${randomUUID().substring(0, 10)}@example.com`,
      preferredLanguage: "ga",
      primaryUserId: anotherId,
    };
    await updateProfile({
      client: client,
      profileId: result,
      ...updateValues,
    });

    const updated = await client.query<{
      primary_user_id: string;
      public_name: string;
      preferred_language: string;
      email: string;
    }>("SELECT * FROM profiles WHERE id = $1", [result]);

    expect(updated.rows).toHaveLength(1);
    expect(updated.rows[0].public_name).toBe(updateValues.publicName);
    expect(updated.rows[0].email).toBe(updateValues.email);
    expect(updated.rows[0].preferred_language).toBe(
      updateValues.preferredLanguage,
    );
    expect(updated.rows[0].primary_user_id).toBe(updateValues.primaryUserId);
  });

  it("should update profile without preferredLanguage", async () => {
    const sampleProfile = getSampleProfile();
    const result = await createProfile(client, sampleProfile);
    const anotherId = randomUUID().substring(0, 12);
    await createProfile(client, {
      ...sampleProfile,
      id: anotherId,
      email: `${randomUUID().substring(0, 10)}@example.com`,
    });
    const updateValues = {
      publicName: `${randomUUID().substring(0, 12)} ${randomUUID().substring(0, 12)}`,
      email: `${randomUUID().substring(0, 10)}@example.com`,
      primaryUserId: anotherId,
    };
    await updateProfile({
      client: client,
      profileId: result,
      ...updateValues,
    });

    const updated = await client.query<{
      primary_user_id: string;
      public_name: string;
      preferred_language: string;
      email: string;
    }>("SELECT * FROM profiles WHERE id = $1", [result]);

    expect(updated.rows).toHaveLength(1);
    expect(updated.rows[0].public_name).toBe(updateValues.publicName);
    expect(updated.rows[0].email).toBe(updateValues.email);
    expect(updated.rows[0].preferred_language).toBe("en");
    expect(updated.rows[0].primary_user_id).toBe(updateValues.primaryUserId);
  });

  it("should throw error if profile does not exist", async () => {
    await expect(
      updateProfile({
        client,
        profileId: randomUUID().substring(0, 12),
        publicName: `${mockProfiles[0].firstName} ${mockProfiles[0].lastName}`,
        email: mockProfiles[0].email,
        primaryUserId: mockDbProfiles[0].primaryUserId,
      }),
    ).rejects.toThrow("Profile does not exist");
  });
});
