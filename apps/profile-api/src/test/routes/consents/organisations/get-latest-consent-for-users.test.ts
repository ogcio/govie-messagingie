import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConsentStatuses } from "~/schemas/consents/shared.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { insertTestConsentStatement } from "~/test/insert-test-consent-statement.js";
import { build } from "~/test/test-server-builder.js";

const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
const organisationId = "latest-consents-org-123";
const subject = "latest-consent-ps-test";
let consentStatementId = randomUUID() as string;
let consentStatementVersion: number;

async function createProfileWithConsent({
  profileId = randomUUID().substring(0, 12),
  detailsId = randomUUID(),
  consentStatus = "opted-in",
  consentCreatedAt = new Date(),
  subject = "latest-consent-ps-test",
  organisationId = "latest-consents-org-123",
} = {}) {
  await pool.query(
    `INSERT INTO profiles (id, public_name, email, primary_user_id, created_at, updated_at)
     VALUES ($1, $2, $3, $1, NOW(), NOW())`,
    [profileId, "Test User", `${profileId}@mail.com`],
  );
  await pool.query(
    `INSERT INTO profile_details (id, profile_id, organisation_id, is_latest)
     VALUES ($1, $2, $3, true)`,
    [detailsId, profileId, organisationId],
  );
  await pool.query(
    `INSERT INTO profile_consents (profile_id, subject, status, created_at, consent_statement_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [profileId, subject, consentStatus, consentCreatedAt, consentStatementId],
  );
  return profileId;
}

async function insertConsentStatement(
  pool: Pool,
  subject: string,
): Promise<{ id: string; version: number }> {
  const statement = await insertTestConsentStatement(pool, {
    subject: subject,
    publishDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Ensure at least 24 hours in the future
    isEnabled: true,
  });
  return statement;
}

describe("GET /api/v1/organisations/consents/latest", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await getServer();
    const { id, version } = await insertConsentStatement(pool, subject);
    consentStatementId = id;
    consentStatementVersion = version;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (pool && !pool.ended) {
      await pool.end();
    }
  });

  it("returns empty array if no consents exist for subject and organisation", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/organisations/consents/latest",
      query: { subject, organisationId },
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toEqual([]);
    expect(body.metadata.totalCount).toBe(0);
  });

  it("returns the latest consent for each profile", async () => {
    const profileId1 = await createProfileWithConsent({
      profileId: "lat-prof-1",
      consentStatus: ConsentStatuses.OptedIn,
      consentCreatedAt: new Date(Date.now() - 1000),
      organisationId,
      subject,
    });
    // Insert an older consent for the same profile (should not be returned)
    await pool.query(
      `INSERT INTO profile_consents (profile_id, subject, status, created_at, consent_statement_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        profileId1,
        subject,
        ConsentStatuses.OptedOut,
        new Date(Date.now() - 2000),
        consentStatementId,
      ],
    );
    // Insert another profile
    const profileId2 = await createProfileWithConsent({
      profileId: "lat-prof-2",
      consentStatus: ConsentStatuses.OptedOut,
      consentCreatedAt: new Date(Date.now() - 500),
      organisationId,
      subject,
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/organisations/consents/latest",
      query: { subject, organisationId },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.length).toBe(2);
    const ids = body.data.map((c: { profileId: string }) => c.profileId);
    expect(ids).toContain(profileId1);
    expect(ids).toContain(profileId2);
    // Should be the latest consent for each profile
    const consent1 = body.data.find(
      (c: { profileId: string }) => c.profileId === profileId1,
    );
    expect(consent1.status).toBe(ConsentStatuses.OptedIn);
    expect(consent1.consentStatement.version).toBe(consentStatementVersion);
    const consent2 = body.data.find(
      (c: { profileId: string }) => c.profileId === profileId2,
    );
    expect(consent2.status).toBe(ConsentStatuses.OptedOut);
    expect(consent2.consentStatement.version).toBe(consentStatementVersion);
  });

  it("returns paginated results", async () => {
    const pagSubject = "paginated-subject-latest";
    for (let i = 0; i < 5; i++) {
      await createProfileWithConsent({
        profileId: `pag-sub-${i}`,
        consentStatus: ConsentStatuses.OptedIn,
        consentCreatedAt: new Date(Date.now() - i * 1000),
        organisationId,
        subject: pagSubject,
      });
    }
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/organisations/consents/latest",
      query: { subject: pagSubject, organisationId, limit: "2", offset: "0" },
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.length).toBe(2);
    expect(body.metadata.totalCount).toBe(5);
  });

  it("returns only consents for profiles with latest profile_details for the organisation", async () => {
    // Insert a profile with is_latest = false (should not be returned)
    const profileId = randomUUID().substring(0, 12);
    await pool.query(
      `INSERT INTO profiles (id, public_name, email, primary_user_id, created_at, updated_at)
       VALUES ($1, $2, $3, $1, NOW(), NOW())`,
      [profileId, "Test User", `${profileId}@mail.com`],
    );
    await pool.query(
      `INSERT INTO profile_details (id, profile_id, organisation_id, is_latest)
       VALUES ($1, $2, $3, false)`,
      [randomUUID(), profileId, organisationId],
    );
    await pool.query(
      `INSERT INTO profile_consents (profile_id, subject, status, created_at, consent_statement_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        profileId,
        subject,
        ConsentStatuses.OptedIn,
        new Date(),
        consentStatementId,
      ],
    );

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/organisations/consents/latest",
      query: { subject, organisationId },
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    // Should not include the profile with is_latest = false
    expect(
      body.data.find((c: { profileId: string }) => c.profileId === profileId),
    ).toBeUndefined();
  });

  const getServer = async () => {
    app = await build();

    app.addHook("onRequest", async (req: FastifyRequest) => {
      app.checkPermissions = async (
        request: FastifyRequest,
        _reply: FastifyReply,
        _permissions: string[],
        _matchConfig?: { method: "AND" | "OR" },
      ) => {
        req.userData = {
          userId: randomUUID(),
          accessToken: "accessToken",
          organizationId: organisationId,
          isM2MApplication: false,
        };

        request.userData = req.userData;
      };
    });

    return app;
  };
});
