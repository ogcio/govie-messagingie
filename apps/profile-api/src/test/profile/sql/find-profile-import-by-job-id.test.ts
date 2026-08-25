import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { ImportStatuses } from "~/const/profile.js";
import { getJobTokenForProfileImport } from "~/services/profiles/sql/get-job-token-for-profile-import.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";

describe("getJobTokenForProfileImport", () => {
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

  it("should return profile import ID when found", async () => {
    const { id, jobToken } = await createImport(client);

    const result = await getJobTokenForProfileImport(client, id);

    expect(result).toBe(jobToken);
  });

  it("should return undefined when no profile import found", async () => {
    const result = await getJobTokenForProfileImport(client, randomUUID());

    expect(result).toBeUndefined();
  });
});

async function createImport(
  client: PoolClient,
  {
    id = randomUUID(),
    organisationId = randomUUID().substring(0, 10),
    source = "csv",
    filename = "test.csv",
    status = ImportStatuses.PROCESSING,
    createdAt = new Date(),
    jobToken = randomUUID(),
  } = {},
) {
  await client.query(
    `INSERT INTO profile_imports (id, organisation_id, source, metadata, status, created_at, job_token)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      organisationId,
      source,
      JSON.stringify({ filename }),
      status,
      createdAt,
      jobToken,
    ],
  );

  return { id, jobToken };
}
