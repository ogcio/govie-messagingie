import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createProfileImport } from "~/services/profiles/sql/create-profile-import.js";
import { createProfileImportDetails } from "~/services/profiles/sql/create-profile-import-details.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { mockProfiles } from "~/test/fixtures/common.js";
import { buildOnce } from "~/test/test-server-builder.js";

const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
const { app, setAuth } = await buildOnce();

afterAll(async () => {
  await app.close();
  if (!pool.ended) {
    await pool.end();
  }
});

describe("GET /api/v1/profiles/imports/:importId", () => {
  let client: PoolClient;

  beforeEach(async () => {
    client = await pool.connect();
  });

  afterEach(() => {
    if (client) {
      client.release();
    }
  });

  it("returns 200 with details for same-org import", async () => {
    const organisationId = `get-import-route-${randomUUID().substring(0, 8)}`;
    const sampleProfiles = mockProfiles.slice(0, 2);
    const metadata = { filename: "test.json", mimetype: "application/json" };
    const profileImport = await createProfileImport(
      client,
      organisationId,
      "json",
      metadata,
    );
    await createProfileImportDetails(
      client,
      profileImport.profileImportId,
      sampleProfiles,
    );

    setAuth({ userId: "userId", organizationId: organisationId });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/profiles/imports/${profileImport.profileImportId}`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.organisationId).toBe(organisationId);
    expect(body.data.details).toHaveLength(sampleProfiles.length);
    expect(
      body.data.details.map((d: { email: string }) => d.email).sort(),
    ).toEqual(sampleProfiles.map((p) => p.email).sort());
  });

  it("returns 404 for other-org import id without leaking details", async () => {
    const ownerOrgId = `get-import-owner-${randomUUID().substring(0, 8)}`;
    const callerOrgId = `get-import-caller-${randomUUID().substring(0, 8)}`;
    const sampleProfiles = mockProfiles.slice(0, 1);
    const metadata = { filename: "secret.json", mimetype: "application/json" };
    const profileImport = await createProfileImport(
      client,
      ownerOrgId,
      "json",
      metadata,
    );
    await createProfileImportDetails(
      client,
      profileImport.profileImportId,
      sampleProfiles,
    );

    setAuth({ userId: "userId", organizationId: callerOrgId });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/profiles/imports/${profileImport.profileImportId}`,
    });

    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(body.data).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain(sampleProfiles[0].email);
    expect(JSON.stringify(body)).not.toContain(ownerOrgId);
  });
});
