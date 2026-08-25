import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { ImportStatuses } from "~/const/profile.js";
import { createProfileImport } from "~/services/profiles/sql/create-profile-import.js";
import { updateProfileImportStatus } from "~/services/profiles/sql/update-profile-import-status.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";

describe("updateProfileImportStatus", () => {
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

  it("should update profile import status", async () => {
    const orgId = `update-profile-import-status-${randomUUID().substring(0, 5)}`;
    const metadata = { filename: "test.json", mimetype: "application/json" };
    const result = await createProfileImport(client, orgId, "json", metadata);

    await updateProfileImportStatus(
      client,
      result.profileImportId,
      ImportStatuses.COMPLETED,
    );
    const { rows } = await client.query(
      "SELECT status FROM profile_imports WHERE id = $1",
      [result.profileImportId],
    );
    expect(rows[0].status).toBe(ImportStatuses.COMPLETED);
  });

  it("should default to failed status if not provided", async () => {
    const orgId = `update-profile-import-status-${randomUUID().substring(0, 5)}`;
    const metadata = { filename: "test.json", mimetype: "application/json" };
    const result = await createProfileImport(client, orgId, "json", metadata);

    await updateProfileImportStatus(client, result.profileImportId);
    const { rows } = await client.query(
      "SELECT status FROM profile_imports WHERE id = $1",
      [result.profileImportId],
    );
    expect(rows[0].status).toBe(ImportStatuses.FAILED);
  });

  it("should execute update even with no affected rows", async () => {
    // Use a random id that does not exist
    await expect(
      updateProfileImportStatus(client, randomUUID()),
    ).resolves.not.toThrow();
  });
});
