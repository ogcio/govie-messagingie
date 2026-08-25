import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Profile } from "~/schemas/profiles/model.js";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import { createProfileDetails } from "~/services/profiles/sql/create-profile-details.js";
import { updateProfileDetailsToNonLatest } from "~/services/profiles/sql/update-profile-details-to-non-latest.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";

describe("updateProfileDetailsToLatest", () => {
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

  it("should update is_latest flag for other profile details", async () => {
    const createdProfileId = await createProfile(client, getMockProfile());
    const orgId = `create-profile-details-${randomUUID().substring(0, 5)}`;
    const oldDetails = await createProfileDetails(
      client,
      createdProfileId,
      orgId,
    );
    const createdDetails = await createProfileDetails(
      client,
      createdProfileId,
      orgId,
    );

    // ensure old one has still is_latest true
    const fromDbOld = await client.query<{ is_latest: boolean }>(
      "SELECT is_latest FROM profile_details WHERE id = $1",
      [oldDetails],
    );
    expect(fromDbOld.rows[0].is_latest).toBe(true);

    const fromDbNew = await client.query<{ is_latest: boolean }>(
      "SELECT is_latest FROM profile_details WHERE id = $1",
      [createdDetails],
    );
    expect(fromDbNew.rows[0].is_latest).toBe(true);

    await updateProfileDetailsToNonLatest(
      client,
      createdDetails,
      orgId,
      createdProfileId,
    );

    const fromDbOldAfter = await client.query<{ is_latest: boolean }>(
      "SELECT is_latest FROM profile_details WHERE id = $1",
      [oldDetails],
    );
    expect(fromDbOldAfter.rows[0].is_latest).toBe(false);

    const fromDbNewAfter = await client.query<{ is_latest: boolean }>(
      "SELECT is_latest FROM profile_details WHERE id = $1",
      [createdDetails],
    );
    expect(fromDbNewAfter.rows[0].is_latest).toBe(true);
  });

  it("should execute update even with no affected rows", async () => {
    const createdProfileId = await createProfile(client, getMockProfile());
    const orgId = `create-profile-details-${randomUUID().substring(0, 5)}`;
    const insertedDetails = await createProfileDetails(
      client,
      createdProfileId,
      orgId,
    );

    await expect(
      updateProfileDetailsToNonLatest(
        client,
        insertedDetails,
        orgId,
        createdProfileId,
      ),
    ).resolves.not.toThrow();
  });
});

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
