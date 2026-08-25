import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { ImportStatuses } from "~/const/profile.js";
import { createProfileImport } from "~/services/profiles/sql/create-profile-import.js";
import { createProfileImportDetails } from "~/services/profiles/sql/create-profile-import-details.js";
import { updateProfileImportDetailsStatus } from "~/services/profiles/sql/update-profile-import-details-status.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { mockProfiles } from "~/test/fixtures/common.js";

describe("updateProfileImportDetailsStatus", () => {
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

  it("should update single import profile detail status", async () => {
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
      [sampleProfiles[0]],
    );

    const fromDb = await client.query<{ status: string }>(
      "SELECT status FROM profile_import_details WHERE id = $1",
      [insertedDetails[0]],
    );
    expect(fromDb.rows[0].status).toBe(ImportStatuses.PENDING);
    await updateProfileImportDetailsStatus(
      client,
      [insertedDetails[0]],
      ImportStatuses.COMPLETED,
    );

    const fromDbUpdated = await client.query<{ status: string }>(
      "SELECT status FROM profile_import_details WHERE id = $1",
      [insertedDetails[0]],
    );
    expect(fromDbUpdated.rows[0].status).toBe(ImportStatuses.COMPLETED);
  });

  it("should update multiple profile details status", async () => {
    const sampleProfiles = mockProfiles.slice(0, 2);
    const orgId = `find-profile-import-details-${randomUUID().substring(0, 5)}`;
    const metadata = { filename: "test.json", mimetype: "application/json" };
    const profileImport = await createProfileImport(
      client,
      orgId,
      "json",
      metadata,
    );

    const insertedDetails = await createProfileImportDetails(
      client,
      profileImport.profileImportId,
      sampleProfiles,
    );

    await updateProfileImportDetailsStatus(
      client,
      insertedDetails,
      ImportStatuses.PROCESSING,
    );

    const fromDbUpdated = await client.query<{ status: string }>(
      "SELECT status FROM profile_import_details WHERE id = ANY($1)",
      [insertedDetails],
    );
    for (const row of fromDbUpdated.rows) {
      expect(row.status).toBe(ImportStatuses.PROCESSING);
    }
  });

  it("should handle empty id list", async () => {
    await expect(
      updateProfileImportDetailsStatus(client, [], ImportStatuses.FAILED),
    ).resolves.not.toThrow();
  });
});
