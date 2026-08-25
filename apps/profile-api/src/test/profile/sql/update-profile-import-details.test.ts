import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { ImportStatuses } from "~/const/profile.js";
import { createProfileImport } from "~/services/profiles/sql/create-profile-import.js";
import { createProfileImportDetails } from "~/services/profiles/sql/create-profile-import-details.js";
import { updateProfileImportDetails } from "~/services/profiles/sql/update-profile-import-details.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { mockProfiles } from "~/test/fixtures/common.js";

describe("updateProfileImportDetails", () => {
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
  it("should update single profile detail", async () => {
    const sampleProfiles = mockProfiles.slice(0, 1);
    const orgId = `update-profile-import-details-${randomUUID().substring(0, 5)}`;
    const metadata = { filename: "test.json", mimetype: "application/json" };
    const result = await createProfileImport(client, orgId, "json", metadata);

    const resultDetails = await createProfileImportDetails(
      client,
      result.profileImportId,
      sampleProfiles,
    );
    await updateProfileImportDetails(
      client,
      resultDetails,
      "Test error message",
      ImportStatuses.FAILED,
    );

    const fromDb = await client.query<{
      status: string;
      error_message: string;
    }>(
      "SELECT status, error_message FROM profile_import_details WHERE id = $1",
      [resultDetails[0]],
    );
    expect(fromDb.rows[0].status).toBe(ImportStatuses.FAILED);
    expect(fromDb.rows[0].error_message).toBe("Test error message");
  });

  it("should update multiple profile details", async () => {
    const sampleProfiles = mockProfiles.slice(0, 2);
    const orgId = `update-profile-import-details-${randomUUID().substring(0, 5)}`;
    const metadata = { filename: "test.json", mimetype: "application/json" };
    const result = await createProfileImport(client, orgId, "json", metadata);

    const resultDetails = await createProfileImportDetails(
      client,
      result.profileImportId,
      sampleProfiles,
    );
    await updateProfileImportDetails(
      client,
      resultDetails,
      "Test error message",
      ImportStatuses.FAILED,
    );

    const fromDb = await client.query<{
      status: string;
      error_message: string;
    }>(
      "SELECT status, error_message FROM profile_import_details WHERE id = ANY($1)",
      [resultDetails],
    );
    expect(fromDb.rows).toHaveLength(2);
    expect(fromDb.rows[0].status).toBe(ImportStatuses.FAILED);
    expect(fromDb.rows[0].error_message).toBe("Test error message");
    expect(fromDb.rows[1].status).toBe(ImportStatuses.FAILED);
    expect(fromDb.rows[1].error_message).toBe("Test error message");
  });

  it("should handle empty id list", async () => {
    await expect(
      updateProfileImportDetails(
        client,
        [],
        "No profiles error",
        ImportStatuses.FAILED,
      ),
    ).resolves.not.toThrow();
  });
});
