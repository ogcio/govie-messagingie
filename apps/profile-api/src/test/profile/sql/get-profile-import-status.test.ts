import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { ImportStatuses } from "~/const/profile.js";
import { createProfileImport } from "~/services/profiles/sql/create-profile-import.js";
import { getProfileImportStatus } from "~/services/profiles/sql/get-profile-import-status.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";

describe("getProfileImportStatus", () => {
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

  it("should return status when found", async () => {
    const orgId = `get-profile-import-status-${randomUUID().substring(0, 5)}`;
    const metadata = { filename: "test.json", mimetype: "application/json" };
    const profileImport = await createProfileImport(
      client,
      orgId,
      "json",
      metadata,
    );

    const result = await getProfileImportStatus(
      client,
      profileImport.profileImportId,
    );

    expect(result).toBe(ImportStatuses.PENDING);
  });

  it("should throw not found error if no status found", async () => {
    const id = randomUUID();
    await expect(getProfileImportStatus(client, id)).rejects.toThrow(
      `Status for profile_import with id ${id} not found`,
    );
  });
});
