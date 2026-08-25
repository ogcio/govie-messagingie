import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConsentStatuses } from "~/schemas/consents/shared.js";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { insertTestConsentStatement } from "~/test/insert-test-consent-statement.js";
import { buildOnce, type MockAuthConfig } from "~/test/test-server-builder.js";

const TEST_SUBJECT = "messaging-get-latest";
const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);

describe("GET - /api/v1/citizens/consents/latest", async () => {
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
    const { id } = await insertTestConsentStatement(pool, {
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

  it("Returns 404 if profile does not exist", async () => {
    setAuth({
      userId: randomUUID().substring(0, 12),
      organizationId: "organisationId",
    });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/citizens/consents/latest",
      query: { subject: TEST_SUBJECT },
    });

    expect(response.statusCode).toBe(404);
  });

  it("Returns 422 if subject is not set as query param", async () => {
    setAuth({
      userId: randomUUID().substring(0, 12),
      organizationId: "organisationId",
    });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/citizens/consents/latest",
    });

    expect(response.statusCode).toBe(422);
    const body = JSON.parse(response.body);
    expect(body.detail).toContain("'subject'");
  });

  it("Returns 404 if profile has no consents", async () => {
    const profileId = randomUUID().substring(0, 12);
    setAuth({ userId: profileId, organizationId: "organisationId" });

    await createProfile(await pool.connect(), {
      id: profileId,
      primaryUserId: profileId,
      publicName: `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
      email: `${randomUUID().substring(0, 5)}@me.com`,
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/citizens/consents/latest",
      query: { subject: TEST_SUBJECT },
    });

    expect(response.statusCode).toBe(404);
  });

  it("Returns latest consent for user", async () => {
    const profileId = randomUUID().substring(0, 12);
    const anotherProfileId = randomUUID().substring(0, 12);
    setAuth({ userId: profileId, organizationId: "organisationId" });

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
      url: "/api/v1/citizens/consents/latest",
      query: { subject: TEST_SUBJECT },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toBeDefined();
    expect(body.data.id).toBe(latestConsentId);
    expect(body.data.status).toBe(ConsentStatuses.OptedOut);
    expect(body.data.subject).toBe(TEST_SUBJECT);
    expect(body.data.profileId).toBe(profileId);
  });

  it("Returns latest consent for the correct subject", async () => {
    const profileId = randomUUID().substring(0, 12);
    setAuth({ userId: profileId, organizationId: "organisationId" });

    await createProfile(await pool.connect(), {
      id: profileId,
      primaryUserId: profileId,
      publicName: `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
      email: `${randomUUID().substring(0, 5)}@me.com`,
    });

    const messagingId = randomUUID();
    await pool.query(
      `INSERT INTO profile_consents (id, profile_id, subject, status, created_at, consent_statement_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        messagingId,
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
        "profile",
        ConsentStatuses.OptedOut,
        new Date(),
        consentStatementId,
      ],
    );

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/citizens/consents/latest",
      query: { subject: TEST_SUBJECT },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toBeDefined();
    expect(body.data.id).toBe(messagingId);
  });
});
