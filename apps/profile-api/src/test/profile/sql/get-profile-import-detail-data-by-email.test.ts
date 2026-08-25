import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createProfileImport } from "~/services/profiles/sql/create-profile-import.js";
import { createProfileImportDetails } from "~/services/profiles/sql/create-profile-import-details.js";
import {
  getProfileImportDetailDataByEmail,
  ProfileImportDetailNotFoundError,
} from "~/services/profiles/sql/get-profile-import-detail-data-by-email.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { mockProfiles } from "~/test/fixtures/common.js";

describe("getProfileImportDetailDataByEmail", () => {
  const sampleProfile = {
    firstName: mockProfiles[0].firstName,
    lastName: mockProfiles[0].lastName,
    email: mockProfiles[0].email,
    phone: mockProfiles[0].phone,
    address: mockProfiles[0].address,
    city: mockProfiles[0].city,
    dateOfBirth: mockProfiles[0].dateOfBirth,
  };

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

  it("should return profile data when found", async () => {
    const orgId = `get-profile-import-details-data-${randomUUID().substring(0, 5)}`;
    const metadata = { filename: "test.json", mimetype: "application/json" };
    const profileImport = await createProfileImport(
      client,
      orgId,
      "json",
      metadata,
    );

    sampleProfile.email = `${randomUUID().substring(0, 6)}@example.com`;
    await createProfileImportDetails(client, profileImport.profileImportId, [
      sampleProfile,
    ]);

    const result = await getProfileImportDetailDataByEmail(
      client,
      profileImport.profileImportId,
      sampleProfile.email,
    );

    expect(result).toEqual(sampleProfile);
  });

  it("should throw error if profile import ID is missing", async () => {
    await expect(
      getProfileImportDetailDataByEmail(client, "", sampleProfile.email),
    ).rejects.toThrow("Profile import ID is required");
  });

  it("should throw error if email is missing", async () => {
    await expect(
      getProfileImportDetailDataByEmail(client, randomUUID(), ""),
    ).rejects.toThrow("Email is required");
  });

  it("should throw ProfileImportDetailNotFoundError if no profile found", async () => {
    await expect(
      getProfileImportDetailDataByEmail(
        client,
        randomUUID(),
        sampleProfile.email,
      ),
    ).rejects.toThrow(ProfileImportDetailNotFoundError);
  });
});
