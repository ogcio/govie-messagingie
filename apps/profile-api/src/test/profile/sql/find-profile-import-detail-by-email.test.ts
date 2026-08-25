import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createProfileImport } from "~/services/profiles/sql/create-profile-import.js";
import { createProfileImportDetails } from "~/services/profiles/sql/create-profile-import-details.js";
import { findProfileImportDetailByEmail } from "~/services/profiles/sql/find-profile-import-detail-by-email.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { mockProfiles } from "~/test/fixtures/common.js";

describe("findProfileImportDetailByEmail", () => {
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

  it("should return profile import detail id when found", async () => {
    const sampleProfiles = mockProfiles.slice(0, 2);
    const orgId = `find-profile-import-details-${randomUUID().substring(0, 5)}`;
    const metadata = { filename: "test.json", mimetype: "application/json" };
    const profileImport = await createProfileImport(
      client,
      orgId,
      "json",
      metadata,
    );

    sampleProfiles[0].email = `${randomUUID().substring(0, 5)}@example.com`;
    const insertedDetails = await createProfileImportDetails(
      client,
      profileImport.profileImportId,
      sampleProfiles,
    );

    const result = await findProfileImportDetailByEmail(
      client,
      profileImport.profileImportId,
      sampleProfiles[0].email,
    );

    expect(result).toBe(insertedDetails[0]);
  });

  it("should throw not found error when no detail exists", async () => {
    const orgId = `find-profile-import-details-${randomUUID().substring(0, 5)}`;
    const metadata = { filename: "test.json", mimetype: "application/json" };
    const profileImport = await createProfileImport(
      client,
      orgId,
      "json",
      metadata,
    );
    await expect(
      findProfileImportDetailByEmail(
        client,
        profileImport.profileImportId,
        "nonexistent@example.com",
      ),
    ).rejects.toThrow("No import details found for email");
  });

  it("should throw not found error when no import exists", async () => {
    await expect(
      findProfileImportDetailByEmail(
        client,
        randomUUID(),
        "nonexistent@example.com",
      ),
    ).rejects.toThrow("No import details found for email");
  });
});
