import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { getProfileImportDetails } from "~/services/profiles/imports/get-profile-import-details.js";
import { createProfileImport } from "~/services/profiles/sql/create-profile-import.js";
import { createProfileImportDetails } from "~/services/profiles/sql/create-profile-import-details.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { mockProfiles } from "~/test/fixtures/common.js";

describe("createProfileImportDetails", () => {
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

  it("should insert profile details and return IDs", async () => {
    const sampleProfiles = mockProfiles.slice(0, 2);
    const orgId = `create-profile-import-details-${randomUUID().substring(0, 5)}`;
    const metadata = { filename: "test.json", mimetype: "application/json" };
    const result = await createProfileImport(client, orgId, "json", metadata);

    const resultDetails = await createProfileImportDetails(
      client,
      result.profileImportId,
      sampleProfiles,
    );

    expect(resultDetails).toHaveLength(sampleProfiles.length);

    const gotDetails = await getProfileImportDetails(
      pool,
      result.profileImportId,
    );
    expect(gotDetails).toHaveLength(sampleProfiles.length);

    // Create a map of profiles by email for easier lookup
    const profileMap = new Map(
      sampleProfiles.map((profile) => [profile.email, profile]),
    );

    // Verify each returned profile matches the expected profile by email
    for (const detail of gotDetails) {
      const expectedProfile = profileMap.get(detail.email);
      expect(expectedProfile).toBeDefined();
      if (expectedProfile) {
        expect(detail).toMatchObject(expectedProfile);
        expect(detail).toHaveProperty("status");
      }
    }
  });

  it("should handle empty profiles array", async () => {
    const orgId = `create-profile-import-details-${randomUUID().substring(0, 5)}`;
    const metadata = { filename: "test.json", mimetype: "application/json" };
    const result = await createProfileImport(client, orgId, "json", metadata);

    const resultDetails = await createProfileImportDetails(
      client,
      result.profileImportId,
      [],
    );

    expect(resultDetails).toEqual([]);
  });
});
