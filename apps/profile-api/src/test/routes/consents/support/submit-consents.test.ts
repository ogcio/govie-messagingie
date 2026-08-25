import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  CascadeConsentReasons,
  ConsentStatuses,
  ConsentSubjects,
} from "~/schemas/consents/shared.js";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { insertTestConsentStatement } from "~/test/insert-test-consent-statement.js";
import { buildOnce, type MockAuthConfig } from "~/test/test-server-builder.js";

const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);

const createdProfileIds: string[] = [];

const createTestProfile = async (profileData: {
  id: string;
  primaryUserId: string;
  publicName: string;
  email: string;
}) => {
  createdProfileIds.push(profileData.id);
  const client = await pool.connect();
  try {
    await createProfile(client, profileData);
  } finally {
    client.release();
  }
};

const generateRandomSubject = () => `subject-${randomUUID().substring(0, 8)}`;

describe("POST /api/v1/support/consents - Integration Tests", async () => {
  let app: FastifyInstance;
  let setAuth: (config: MockAuthConfig) => void;
  beforeAll(async () => {
    const server = await buildOnce();
    app = server.app;
    setAuth = server.setAuth;

    const currentDate = new Date(Date.now() - 1000);

    await insertTestConsentStatement(pool, {
      subject: ConsentSubjects.Messaging,
      publishDate: currentDate,
      isEnabled: true,
    });
  });

  afterEach(async () => {
    if (createdProfileIds.length === 0) return;

    try {
      await pool.query(
        "DELETE FROM profile_consents WHERE profile_id = ANY($1)",
        [createdProfileIds],
      );
      await pool.query(
        "DELETE FROM profile_data WHERE profile_details_id IN (SELECT id FROM profile_details WHERE profile_id = ANY($1))",
        [createdProfileIds],
      );
      await pool.query(
        "DELETE FROM profile_details WHERE profile_id = ANY($1)",
        [createdProfileIds],
      );
      await pool.query("DELETE FROM profiles WHERE id = ANY($1)", [
        createdProfileIds,
      ]);
    } catch (error) {
      console.warn("Cleanup error (ignored):", error);
    } finally {
      createdProfileIds.length = 0;
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe("Access control validation", () => {
    it("Returns 403 if logged in user is a public servant (has organizationId)", async () => {
      const profileId = randomUUID().substring(0, 12);
      setAuth({
        userId: randomUUID().substring(0, 12),
        organizationId: "organisationId",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/support/consents",
        body: {
          profileId,
          consents: [
            {
              subject: ConsentSubjects.Messaging,
              status: ConsentStatuses.OptedIn,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("Returns 403 if logged in user is a citizen (not M2M)", async () => {
      const profileId = randomUUID().substring(0, 12);
      setAuth({
        userId: randomUUID().substring(0, 12),
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/support/consents",
        body: {
          profileId,
          consents: [
            {
              subject: ConsentSubjects.Messaging,
              status: ConsentStatuses.OptedIn,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("Schema validation", () => {
    it("Returns 422 if body is missing profileId", async () => {
      setAuth({
        userId: randomUUID().substring(0, 12),
        isM2MApplication: true,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/support/consents",
        body: {
          consents: [
            {
              subject: ConsentSubjects.Messaging,
              status: ConsentStatuses.OptedIn,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(422);
    });

    it("Returns 422 if body is missing required consent fields", async () => {
      const profileId = randomUUID().substring(0, 12);
      setAuth({
        userId: randomUUID().substring(0, 12),
        isM2MApplication: true,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/support/consents",
        body: {
          profileId,
          consents: [
            {
              subject: ConsentSubjects.Messaging,
              // Missing status
            },
          ],
        },
      });

      expect(response.statusCode).toBe(422);
    });

    it("Returns 422 if consents array is empty", async () => {
      const profileId = randomUUID().substring(0, 12);
      setAuth({
        userId: randomUUID().substring(0, 12),
        isM2MApplication: true,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/support/consents",
        body: {
          profileId,
          consents: [],
        },
      });

      expect(response.statusCode).toBe(422);
    });
  });

  describe("Profile validation", () => {
    it("Returns 404 if profile does not exist", async () => {
      setAuth({
        userId: randomUUID().substring(0, 12),
        isM2MApplication: true,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/support/consents",
        body: {
          profileId: randomUUID().substring(0, 12),
          consents: [
            {
              subject: ConsentSubjects.Messaging,
              status: ConsentStatuses.OptedIn,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it("Returns 400 when trying to submit for child profile", async () => {
      const primaryProfileId = randomUUID().substring(0, 12);
      const childProfileId = randomUUID().substring(0, 12);
      setAuth({
        userId: randomUUID().substring(0, 12),
        isM2MApplication: true,
      });

      await createTestProfile({
        id: primaryProfileId,
        primaryUserId: primaryProfileId,
        publicName: `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
        email: `${randomUUID().substring(0, 5)}@me.com`,
      });

      await createTestProfile({
        id: childProfileId,
        primaryUserId: primaryProfileId,
        publicName: `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
        email: `${randomUUID().substring(0, 5)}@me.com`,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/support/consents",
        body: {
          profileId: childProfileId,
          consents: [
            {
              subject: ConsentSubjects.Messaging,
              status: ConsentStatuses.OptedIn,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("Statement validation", () => {
    it("Returns 400 when no current statement exists for subject", async () => {
      const profileId = randomUUID().substring(0, 12);
      setAuth({
        userId: randomUUID().substring(0, 12),
        isM2MApplication: true,
      });

      await createTestProfile({
        id: profileId,
        primaryUserId: profileId,
        publicName: `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
        email: `${randomUUID().substring(0, 5)}@me.com`,
      });

      const nonExistentSubject = generateRandomSubject();
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/support/consents",
        body: {
          profileId,
          consents: [
            {
              subject: nonExistentSubject,
              status: ConsentStatuses.OptedIn,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);

      expect(body.detail).toContain(
        `No current active statement found for subject '${nonExistentSubject}'`,
      );
    });
  });

  describe("Successful submissions", () => {
    it("Successfully submits single consent for user", async () => {
      const profileId = randomUUID().substring(0, 12);
      setAuth({
        userId: randomUUID().substring(0, 12),
        isM2MApplication: true,
      });

      await createTestProfile({
        id: profileId,
        primaryUserId: profileId,
        publicName: `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
        email: `${randomUUID().substring(0, 5)}@me.com`,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/support/consents",
        body: {
          profileId,
          consents: [
            {
              subject: ConsentSubjects.Messaging,
              status: ConsentStatuses.OptedIn,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].subject).toBe(ConsentSubjects.Messaging);
      expect(body.data[0].status).toBe(ConsentStatuses.OptedIn);
      expect(body.data[0].consentStatementId).toBeDefined();
      expect(body.data[0].isLatestStatement).toBe(true);
    });

    it("Successfully submits multiple consents for different subjects", async () => {
      const profileId = randomUUID().substring(0, 12);
      setAuth({
        userId: randomUUID().substring(0, 12),
        isM2MApplication: true,
      });

      await createTestProfile({
        id: profileId,
        primaryUserId: profileId,
        publicName: `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
        email: `${randomUUID().substring(0, 5)}@me.com`,
      });

      const randomSubject = generateRandomSubject();
      await insertTestConsentStatement(pool, {
        subject: randomSubject,
        publishDate: new Date(Date.now() - 1000),
        isEnabled: true,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/support/consents",
        body: {
          profileId,
          consents: [
            {
              subject: ConsentSubjects.Messaging,
              status: ConsentStatuses.OptedIn,
            },
            {
              subject: randomSubject,
              status: ConsentStatuses.OptedOut,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(2);
      expect(body.data[0].subject).toBe(ConsentSubjects.Messaging);
      expect(body.data[0].status).toBe(ConsentStatuses.OptedIn);
      expect(body.data[1].subject).toBe(randomSubject);
      expect(body.data[1].status).toBe(ConsentStatuses.OptedOut);
    });

    it("Auto-resolves the current consent statement for each subject", async () => {
      const profileId = randomUUID().substring(0, 12);
      setAuth({
        userId: randomUUID().substring(0, 12),
        isM2MApplication: true,
      });

      await createTestProfile({
        id: profileId,
        primaryUserId: profileId,
        publicName: `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
        email: `${randomUUID().substring(0, 5)}@me.com`,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/support/consents",
        body: {
          profileId,
          consents: [
            {
              subject: ConsentSubjects.Messaging,
              status: ConsentStatuses.OptedOut,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data[0].consentStatementId).toBeDefined();
      expect(typeof body.data[0].consentStatementId).toBe("string");
    });
  });

  describe("Batch validation", () => {
    it("Validates all consents before processing any (atomicity)", async () => {
      const profileId = randomUUID().substring(0, 12);
      setAuth({
        userId: randomUUID().substring(0, 12),
        isM2MApplication: true,
      });

      await createTestProfile({
        id: profileId,
        primaryUserId: profileId,
        publicName: `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
        email: `${randomUUID().substring(0, 5)}@me.com`,
      });

      const invalidSubject = generateRandomSubject();
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/support/consents",
        body: {
          profileId,
          consents: [
            {
              subject: ConsentSubjects.Messaging,
              status: ConsentStatuses.OptedIn,
            },
            {
              subject: invalidSubject,
              status: ConsentStatuses.OptedIn,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);

      // Verify no consents were actually created (atomicity)
      const { rows } = await pool.query(
        "SELECT COUNT(*) as count FROM profile_consents WHERE profile_id = $1",
        [profileId],
      );
      expect(Number(rows[0].count)).toBe(0);
    });
  });

  describe("Linked profiles", () => {
    it("Handles linked profiles correctly", async () => {
      const profileId = randomUUID().substring(0, 12);
      const linkedProfileId = randomUUID().substring(0, 12);
      setAuth({
        userId: randomUUID().substring(0, 12),
        isM2MApplication: true,
      });

      await createTestProfile({
        id: profileId,
        primaryUserId: profileId,
        publicName: `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
        email: `${randomUUID().substring(0, 5)}@me.com`,
      });

      await createTestProfile({
        id: linkedProfileId,
        primaryUserId: profileId,
        publicName: `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
        email: `${randomUUID().substring(0, 5)}@me.com`,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/support/consents",
        body: {
          profileId,
          consents: [
            {
              subject: ConsentSubjects.Messaging,
              status: ConsentStatuses.OptedOut,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(201);

      // Verify consents were created for both profiles
      const { rows: consentRows } = await pool.query(
        "SELECT * FROM profile_consents WHERE profile_id IN ($1, $2)",
        [profileId, linkedProfileId],
      );
      expect(consentRows).toHaveLength(2);

      // Verify linked profile consent has cascade info
      const linkedConsent = consentRows.find(
        (c) => c.profile_id === linkedProfileId,
      );
      expect(linkedConsent.cascade_reason).toBe(
        CascadeConsentReasons.ExplicitSubmission,
      );
      expect(linkedConsent.cascade_source_profile_id).toBe(profileId);
    });
  });
});
