import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { createUpdateProfileDetails } from "~/services/profiles/create-update-profile-details.js";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import { lookupProfile } from "~/services/profiles/sql/lookup-profile.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { mockDbProfiles } from "~/test/fixtures/common.js";

describe("lookupProfile", () => {
  const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
  let client: PoolClient;
  const sampleProfile = {
    ...mockDbProfiles[0],
    id: randomUUID().substring(0, 12),
    email: `${randomUUID().substring(0, 5)}@example.com`,
    safeLevel: 1,
  };
  const orgId = randomUUID().substring(0, 11);
  const testData = {
    firstName: randomUUID().substring(0, 5),
    lastName: randomUUID().substring(0, 5),
    email: `${randomUUID().substring(0, 5)}@example.com`,
    phone: randomUUID().substring(0, 5),
  };
  let profileDetailId: string | undefined;

  beforeAll(async () => {
    client = await pool.connect();
    const created = await createProfile(client, sampleProfile);
    profileDetailId = await createUpdateProfileDetails({
      client,
      organizationId: orgId,
      profileId: created,
      data: testData,
      createOnly: false,
    });
    client.release();
  });

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

  it("should find profile by direct email match", async () => {
    const result = await lookupProfile(client, sampleProfile.email);
    expect(result).toEqual({
      exists: true,
      profileId: sampleProfile.id,
      profileDetailId,
    });
  });

  it("should find profile by profile_data email match", async () => {
    const result = await lookupProfile(client, testData.email);
    expect(result).toEqual({
      exists: true,
      profileId: sampleProfile.id,
      profileDetailId,
    });
  });

  it("should handle no profile found", async () => {
    const result = await lookupProfile(client, "nonexistent@example.com");
    expect(result).toEqual({
      exists: false,
      profileId: undefined,
      profileDetailId: undefined,
    });
  });
});
