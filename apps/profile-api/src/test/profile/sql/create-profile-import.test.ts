import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createProfileImport } from "~/services/profiles/sql/create-profile-import.js";
import { getProfileImport } from "~/services/profiles/sql/get-profile-import.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";

describe("createProfileImport", () => {
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

  it("should create profile import with default source and return IDs", async () => {
    const orgId = `create-profile-import-${randomUUID().substring(0, 5)}`;
    const result = await createProfileImport(client, orgId);

    expect(result.profileImportId).toBeDefined();
    expect(result.jobToken).toBeDefined;

    const got = await getProfileImport(client, result.profileImportId);
    expect(got.organisationId).toStrictEqual(orgId);
  });

  it("should create profile import with specified source and metadata", async () => {
    const orgId = `create-profile-import-${randomUUID().substring(0, 5)}`;
    const metadata = { filename: "test.json", mimetype: "application/json" };
    const result = await createProfileImport(client, orgId, "json", metadata);

    const got = await getProfileImport(client, result.profileImportId);
    expect(got.organisationId).toStrictEqual(orgId);
    expect(got.metadata).toStrictEqual(metadata);
  });

  it("should throw error if insert fails", async () => {
    const stringLongerThanMax = new Array(300).join("-");
    await expect(
      createProfileImport(client, stringLongerThanMax),
    ).rejects.toThrow("value too long for type character varying(255)");
  });
});
