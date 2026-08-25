import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { PAGINATION_LIMIT_DEFAULT } from "~/const/pagination.js";
import { ConsentStatuses } from "~/schemas/consents/shared.js";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { insertTestConsentStatement } from "~/test/insert-test-consent-statement.js";
import { buildOnce, type MockAuthConfig } from "~/test/test-server-builder.js";

describe("GET - /api/v1/citizens/consents", async () => {
  let app: FastifyInstance;
  let setAuth: (config: MockAuthConfig) => void;

  let consentStatementIdList: string;
  let consentStatementVersionList: number;
  let client: PoolClient;

  const TEST_SUBJECT = "messaging-list";
  const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);

  beforeEach(async () => {
    client = await pool.connect();
  });

  beforeAll(async () => {
    const server = await buildOnce();
    app = server.app;
    setAuth = server.setAuth;

    // Create a consent statement first
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1); // Set to tomorrow
    const { id, version } = await insertTestConsentStatement(pool, {
      subject: TEST_SUBJECT,
      publishDate: futureDate,
      isEnabled: true,
    });

    consentStatementIdList = id;
    consentStatementVersionList = version;
  });

  afterEach(async () => {
    if (client) {
      client.release();
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (!pool.ended) {
      await pool.end();
    }
  });

  it("Returns empty array if profile has no consents", async () => {
    const profileId = randomUUID().substring(0, 12);
    setAuth({ userId: profileId, organizationId: "organisationId" });

    await createProfile(client, {
      id: profileId,
      primaryUserId: profileId,
      publicName: `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
      email: `${randomUUID().substring(0, 5)}@me.com`,
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/citizens/consents?subject=${TEST_SUBJECT}`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toEqual([]);
    expect(body.metadata).toBeDefined();
    expect(body.metadata.totalCount).toBe(0);
  });

  it("Returns 422 if subject is not provided", async () => {
    const profileId = randomUUID().substring(0, 12);
    setAuth({ userId: profileId, organizationId: "organisationId" });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/citizens/consents",
    });

    expect(response.statusCode).toBe(422);
    const body = JSON.parse(response.body);
    expect(body.detail).toContain("subject");
  });

  it("Returns only consents for the requested subject", async () => {
    const profileId = randomUUID().substring(0, 12);
    setAuth({ userId: profileId, organizationId: "organisationId" });

    await createProfile(client, {
      id: profileId,
      primaryUserId: profileId,
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
        new Date(),
        consentStatementIdList,
      ],
    );

    await pool.query(
      `INSERT INTO profile_consents (id, profile_id, subject, status, created_at, consent_statement_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        randomUUID(),
        profileId,
        "profile",
        ConsentStatuses.OptedIn,
        new Date(),
        consentStatementIdList,
      ],
    );

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/citizens/consents?subject=${TEST_SUBJECT}`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toHaveLength(1);
    expect(body.metadata).toBeDefined();
    expect(body.metadata.totalCount).toBe(1);
    expect(body.data[0].subject).toBe(TEST_SUBJECT);
    expect(body.data[0].consentStatement.version).toBe(
      consentStatementVersionList,
    );
  });

  it("Returns paginated consents for user", async () => {
    const profileId = randomUUID().substring(0, 12);
    const anotherProfileId = randomUUID().substring(0, 12);
    setAuth({ userId: profileId, organizationId: "organisationId" });

    await createProfile(client, {
      id: profileId,
      primaryUserId: profileId,
      publicName: `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
      email: `${randomUUID().substring(0, 5)}@me.com`,
    });

    await createProfile(client, {
      id: anotherProfileId,
      primaryUserId: anotherProfileId,
      publicName: `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
      email: `${randomUUID().substring(0, 5)}@me.com`,
    });

    for (let i = 0; i < 3; i++) {
      await pool.query(
        `INSERT INTO profile_consents (id, profile_id, subject, status, created_at, consent_statement_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          randomUUID(),
          profileId,
          TEST_SUBJECT,
          ConsentStatuses.OptedIn,
          new Date(Date.now() - i * 1000),
          consentStatementIdList,
        ],
      );
    }

    // Create a consent for another profile to ensure it's not returned
    await pool.query(
      `INSERT INTO profile_consents (id, profile_id, subject, status, created_at, consent_statement_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        randomUUID(),
        anotherProfileId,
        TEST_SUBJECT,
        ConsentStatuses.OptedOut,
        new Date(),
        consentStatementIdList,
      ],
    );

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/citizens/consents?subject=${TEST_SUBJECT}&limit=2&offset=0`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toHaveLength(2);
    expect(body.metadata).toBeDefined();
    expect(body.metadata.totalCount).toBe(3);
    expect(body.data[0].profileId).toBe(profileId);
    expect(body.data[1].profileId).toBe(profileId);

    const secondResponse = await app.inject({
      method: "GET",
      url: `/api/v1/citizens/consents?subject=${TEST_SUBJECT}&limit=2&offset=2`,
    });

    const secondBody = JSON.parse(secondResponse.body);
    expect(secondBody.data).toHaveLength(1);
    expect(secondBody.metadata).toBeDefined();
    expect(secondBody.metadata.totalCount).toBe(3);
    expect(secondBody.data[0].profileId).toBe(profileId);
  });

  it("Uses default pagination values when not provided", async () => {
    const profileId = randomUUID().substring(0, 12);
    setAuth({ userId: profileId, organizationId: "organisationId" });

    await createProfile(client, {
      id: profileId,
      primaryUserId: profileId,
      publicName: `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
      email: `${randomUUID().substring(0, 5)}@me.com`,
    });

    for (let i = 0; i < 25; i++) {
      await pool.query(
        `INSERT INTO profile_consents (id, profile_id, subject, status, created_at, consent_statement_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          randomUUID(),
          profileId,
          TEST_SUBJECT,
          ConsentStatuses.OptedIn,
          new Date(Date.now() - i * 1000),
          consentStatementIdList,
        ],
      );
    }

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/citizens/consents?subject=${TEST_SUBJECT}`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toHaveLength(PAGINATION_LIMIT_DEFAULT);
    expect(body.metadata).toBeDefined();
    expect(body.metadata.totalCount).toBe(25);
  });
});
