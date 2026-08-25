import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { ImportStatuses } from "~/const/profile.js";
import { createProfileImport } from "~/services/profiles/sql/create-profile-import.js";
import { createProfileImportDetails } from "~/services/profiles/sql/create-profile-import-details.js";
import { getProfileImportDetails } from "~/services/profiles/sql/get-profile-import-details.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { mockProfiles } from "~/test/fixtures/common.js";

describe("getProfileImportDetails", () => {
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

  it("should return profile details when found", async () => {
    const insertedProfiles = mockProfiles.slice(0, 2);
    const orgId = `get-profile-import-details-${randomUUID().substring(0, 5)}`;
    const metadata = { filename: "test.json", mimetype: "application/json" };
    const profileImport = await createProfileImport(
      client,
      orgId,
      "json",
      metadata,
    );

    await createProfileImportDetails(
      client,
      profileImport.profileImportId,
      insertedProfiles,
    );
    const result = await getProfileImportDetails(
      client,
      profileImport.profileImportId,
    );

    const firstProfile = result.find(
      (profile) => profile.email === insertedProfiles[0].email,
    );
    const secondProfile = result.find(
      (profile) => profile.email === insertedProfiles[1].email,
    );
    expect(firstProfile).toBeDefined();
    expect(secondProfile).toBeDefined();
    expect(firstProfile).toMatchObject({
      email: insertedProfiles[0].email,
      phone: insertedProfiles[0].phone,
      firstName: insertedProfiles[0].firstName,
      lastName: insertedProfiles[0].lastName,
      dateOfBirth: insertedProfiles[0].dateOfBirth,
      ppsn: insertedProfiles[0].ppsn,
      city: insertedProfiles[0].city,
      address: insertedProfiles[0].address,
      externalId: insertedProfiles[0].externalId,
      status: ImportStatuses.PENDING,
    });
    expect(secondProfile).toMatchObject({
      email: insertedProfiles[1].email,
      phone: insertedProfiles[1].phone,
      firstName: insertedProfiles[1].firstName,
      lastName: insertedProfiles[1].lastName,
      dateOfBirth: insertedProfiles[1].dateOfBirth,
      ppsn: insertedProfiles[1].ppsn,
      city: insertedProfiles[1].city,
      address: insertedProfiles[1].address,
      externalId: insertedProfiles[1].externalId,
      status: ImportStatuses.PENDING,
    });
  });

  it("should throw error if import ID is missing", async () => {
    await expect(getProfileImportDetails(client, "")).rejects.toThrow(
      "Profile import ID is required",
    );
  });

  it("should throw not found error if no details exist", async () => {
    const orgId = `get-profile-import-details-${randomUUID().substring(0, 5)}`;
    const metadata = { filename: "test.json", mimetype: "application/json" };
    const profileImport = await createProfileImport(
      client,
      orgId,
      "json",
      metadata,
    );
    await expect(
      getProfileImportDetails(client, profileImport.profileImportId),
    ).rejects.toThrow(
      `No import details found for import ID: ${profileImport.profileImportId}`,
    );
  });
});
