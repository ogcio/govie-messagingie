import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createUpdateProfileDetails,
  ProfileDetailsError,
} from "~/services/profiles/create-update-profile-details.js";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { mockDbProfiles } from "~/test/fixtures/common.js";

describe("createUpdateProfileDetails", () => {
  const getSampleProfile = () => ({
    ...mockDbProfiles[0],
    safeLevel: 1,
    id: randomUUID().substring(0, 12),
    email: `${randomUUID().substring(0, 5)}@example.com`,
  });

  const getTestData = (): Record<string, string> => ({
    firstName: randomUUID().substring(0, 5),
    lastName: randomUUID().substring(0, 5),
    email: `${randomUUID().substring(0, 5)}@example.com`,
    phone: randomUUID().substring(0, 5),
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

  it("should create profile details and return detail ID", async () => {
    const sampleProfile = getSampleProfile();
    const created = await createProfile(client, sampleProfile);
    const orgId = randomUUID().substring(0, 11);
    const testData = getTestData();
    const result = await createUpdateProfileDetails({
      client,
      organizationId: orgId,
      profileId: created,
      data: testData,
      createOnly: false,
    });

    expect(result).toBeDefined();
    const fromDb = await client.query<{ id: string; is_latest: boolean }>(
      "SELECT id, is_latest FROM profile_details WHERE id = $1",
      [result],
    );
    expect(fromDb.rows).toHaveLength(1);
    expect(fromDb.rows[0].is_latest).toBe(true);
    const fromDbData = await client.query<{
      profile_details_id: string;
      name: string;
      value_type: string;
      value: string;
    }>(
      `SELECT profile_details_id,
      name,
      value_type,
      value FROM profile_data WHERE profile_details_id = $1`,
      [result],
    );

    expect(fromDbData.rows).toHaveLength(Object.keys(testData).length);
    for (const key of Object.keys(testData)) {
      const currentData = fromDbData.rows.find((row) => row.name === key);
      expect(currentData).toBeDefined();
      expect(currentData?.value).toBe(testData[key]);
    }
  });

  it("should handle ProfileDetailsError and rethrow", async () => {
    await expect(
      createUpdateProfileDetails({
        client,
        organizationId: "org-123",
        profileId: mockDbProfiles[0].id,
        data: getTestData(),
        createOnly: false,
      }),
    ).rejects.toThrow(ProfileDetailsError);
  });

  it("should wrap unknown errors in ProfileDetailsError", async () => {
    const sampleProfile = getSampleProfile();
    const created = await createProfile(client, sampleProfile);
    const orgId = randomUUID().substring(0, 11);
    const oldTest = getTestData();
    // Inserting an old one to ensure that, if the second fails, this one is maintained
    // as latest
    const oldId = await createUpdateProfileDetails({
      client,
      organizationId: orgId,
      profileId: created,
      data: oldTest,
      createOnly: false,
    });

    const testData = getTestData();
    // should throw because profileData.value is 255
    testData.firstName = "a".repeat(300);
    await expect(
      createUpdateProfileDetails({
        client,
        organizationId: orgId,
        profileId: created,
        data: testData,
        createOnly: false,
      }),
    ).rejects.toThrow(ProfileDetailsError);

    const isOldLatest = await client.query<{ is_latest: boolean }>(
      `
      SELECT is_latest FROM profile_details WHERE id = $1
    `,
      [oldId],
    );
    expect(isOldLatest.rows[0].is_latest).toBe(true);
  });

  it("should not create profile details if they already exist", async () => {
    const sampleProfile = getSampleProfile();
    const created = await createProfile(client, sampleProfile);
    const orgId = randomUUID().substring(0, 11);
    const oldTest = getTestData();
    await createUpdateProfileDetails({
      client,
      organizationId: orgId,
      profileId: created,
      data: oldTest,
      createOnly: false,
    });
    const previousCount = await client.query<{ count: number }>(
      `
      SELECT COUNT(*) as "count" FROM profile_details WHERE profile_id = $1 and organisation_id = $2
    `,
      [created, orgId],
    );
    const result = await createUpdateProfileDetails({
      client,
      organizationId: orgId,
      profileId: created,
      data: oldTest,
      createOnly: true,
    });

    expect(result).toBe(undefined);

    const newCount = await client.query<{ count: number }>(
      `
      SELECT COUNT(*) as "count" FROM profile_details WHERE profile_id = $1 and organisation_id = $2
    `,
      [created, orgId],
    );

    expect(newCount.rows[0].count).toBe(previousCount.rows[0].count);
  });

  it("should create profile details and format input data correctly", async () => {
    const sampleProfile = getSampleProfile();
    const created = await createProfile(client, sampleProfile);
    const orgId = randomUUID().substring(0, 11);
    const testData = getTestData();
    testData.dateOfBirth = "27/10/1990";
    const expectedDate = "1990-10-27";

    const result = await createUpdateProfileDetails({
      client,
      organizationId: orgId,
      profileId: created,
      data: testData,
      createOnly: false,
    });

    expect(result).toBeDefined();
    const fromDb = await client.query<{ id: string; is_latest: boolean }>(
      "SELECT id, is_latest FROM profile_details WHERE id = $1",
      [result],
    );
    expect(fromDb.rows).toHaveLength(1);
    expect(fromDb.rows[0].is_latest).toBe(true);
    const fromDbData = await client.query<{
      profile_details_id: string;
      name: string;
      value_type: string;
      value: string;
    }>(
      `SELECT profile_details_id,
      name,
      value_type,
      value FROM profile_data WHERE profile_details_id = $1`,
      [result],
    );

    expect(fromDbData.rows).toHaveLength(Object.keys(testData).length);
    for (const key of Object.keys(testData)) {
      const currentData = fromDbData.rows.find((row) => row.name === key);
      expect(currentData).toBeDefined();
      if (key === "dateOfBirth") {
        expect(currentData?.value).toBe(expectedDate);
      } else {
        expect(currentData?.value).toBe(testData[key]);
      }
    }
  });
});
