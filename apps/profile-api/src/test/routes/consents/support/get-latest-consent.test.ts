import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConsentStatuses, ConsentSubjects } from "~/schemas/consents/shared.js";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { getLatestOrInsertTestConsentStatement } from "~/test/insert-test-consent-statement.js";
import { buildOnce, type MockAuthConfig } from "~/test/test-server-builder.js";

const TEST_SUBJECT = "messaging";
const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);

describe("GET - /api/v1/support/consents/latest", { skip: true }, async () => {
  let app: FastifyInstance;
  let setAuth: (config: MockAuthConfig) => void;

  let consentStatementId: string;

  beforeAll(async () => {
    const server = await buildOnce();
    app = server.app;
    setAuth = server.setAuth;

    // Create a consent statement first
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1); // Set to tomorrow
    const { id } = await getLatestOrInsertTestConsentStatement(pool, {
      subject: TEST_SUBJECT,
      publishDate: futureDate,
      isEnabled: true,
    });

    consentStatementId = id;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it("Returns 403 if logged in profile is a public servant", async () => {
    setAuth({
      userId: randomUUID().substring(0, 12),
      organizationId: "organisationId",
    });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/support/consents/latest",
      query: { profileId: randomUUID().substring(0, 12) },
    });

    expect(response.statusCode).toBe(403);
  });

  it("Returns 403 if logged in profile is a citizen", async () => {
    setAuth({
      userId: randomUUID().substring(0, 12),
    });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/support/consents/latest",
      query: { profileId: randomUUID().substring(0, 12) },
    });

    expect(response.statusCode).toBe(403);
  });
  it("Returns 404 if profile does not exist", async () => {
    setAuth({
      userId: randomUUID().substring(0, 12),
      isM2MApplication: true,
    });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/support/consents/latest",
      query: { profileId: randomUUID().substring(0, 12) },
    });

    expect(response.statusCode).toBe(404);
  });

  it("Returns 422 if profileId is not set as query param", async () => {
    setAuth({
      userId: randomUUID().substring(0, 12),
      isM2MApplication: true,
    });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/support/consents/latest",
    });

    expect(response.statusCode).toBe(422);
    const body = JSON.parse(response.body);
    expect(body.detail).toContain("'profileId'");
  });

  it("Returns 404 if profile has no consents", async () => {
    const profileId = randomUUID().substring(0, 12);
    setAuth({ userId: profileId, isM2MApplication: true });

    await createProfile(await pool.connect(), {
      id: profileId,
      primaryUserId: profileId,
      publicName: `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
      email: `${randomUUID().substring(0, 5)}@me.com`,
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/support/consents/latest",
      query: { profileId },
    });

    expect(response.statusCode).toBe(404);
  });

  it("Returns latest consent for user", async () => {
    const profileId = randomUUID().substring(0, 12);
    const anotherProfileId = randomUUID().substring(0, 12);
    setAuth({ userId: profileId, isM2MApplication: true });

    await createProfile(await pool.connect(), {
      id: profileId,
      primaryUserId: profileId,
      publicName: `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
      email: `${randomUUID().substring(0, 5)}@me.com`,
    });

    await createProfile(await pool.connect(), {
      id: anotherProfileId,
      primaryUserId: anotherProfileId,
      publicName: `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
      email: `${randomUUID().substring(0, 5)}@me.com`,
    });

    await pool.query(
      `INSERT INTO profile_consents (id, profile_id, subject, status, created_at, consent_statement_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        randomUUID(),
        profileId,
        TEST_SUBJECT,
        ConsentStatuses.OptedIn,
        new Date(Date.now() - 1000),
        consentStatementId,
      ],
    );

    const latestConsentId = randomUUID();
    await pool.query(
      `INSERT INTO profile_consents (id, profile_id, subject, status, created_at, consent_statement_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        latestConsentId,
        profileId,
        TEST_SUBJECT,
        ConsentStatuses.OptedOut,
        new Date(),
        consentStatementId,
      ],
    );

    // add a newer consent for another profile to
    // ensure is not returned for the logged in user
    await pool.query(
      `INSERT INTO profile_consents (id, profile_id, subject, status, created_at, consent_statement_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        randomUUID(),
        anotherProfileId,
        TEST_SUBJECT,
        ConsentStatuses.OptedOut,
        new Date(Date.now() + 2000),
        consentStatementId,
      ],
    );

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/support/consents/latest",
      query: { profileId },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toBeDefined();
    expect(body.data.availableSubjects).toStrictEqual([
      ConsentSubjects.Messaging,
    ]);
    expect(body.data.consents).toBeDefined();
    expect(body.data.consents.length).toBe(1);
    expect(body.data.consents[0].id).toBe(latestConsentId);
    expect(body.data.consents[0].status).toBe(ConsentStatuses.OptedOut);
    expect(body.data.consents[0].subject).toBe(TEST_SUBJECT);
    expect(body.data.consents[0].profileId).toBe(profileId);
  });
});
