import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Profile } from "~/schemas/profiles/model.js";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import { createProfileDetails } from "~/services/profiles/sql/create-profile-details.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";

const getMockProfile = (): Profile => {
  const profileId = randomUUID().substring(0, 12);
  return {
    id: profileId,
    publicName: randomUUID(),
    email: `${randomUUID().substring(0, 10)}@email.com`,
    primaryUserId: profileId,
    preferredLanguage: "en",
    status: "active",
  };
};

describe("createProfileDetails", () => {
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

  it("should insert the correct data", async () => {
    const createdProfileId = await createProfile(client, getMockProfile());
    const orgId = `create-profile-details-${randomUUID().substring(0, 5)}`;
    const createdDetails = await createProfileDetails(
      client,
      createdProfileId,
      orgId,
    );

    expect(createdDetails).toBeDefined();

    const selectResult = await client.query<{
      id: string;
      profile_id: string;
      organisation_id: string;
      is_latest: boolean;
    }>(
      `
      SELECT
        id,
        profile_id,
        organisation_id,
        is_latest
      FROM profile_details
      WHERE id = $1
      `,
      [createdDetails],
    );
    expect(selectResult.rowCount).toBe(1);
    expect(selectResult.rows[0]).toStrictEqual({
      id: createdDetails,
      profile_id: createdProfileId,
      organisation_id: orgId,
      is_latest: true,
    });
  });

  it("should throw error if no ID is returned", async () => {
    await expect(
      createProfileDetails(client, "not existent id", "org-123"),
    ).rejects.toThrowError();
  });
});
