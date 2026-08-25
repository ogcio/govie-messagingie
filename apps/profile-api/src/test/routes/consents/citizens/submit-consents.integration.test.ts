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

// Helper function to create profile with proper connection management
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

// Helper function to generate random subjects to avoid conflicts with other test suites
const generateRandomSubject = () => `subject-${randomUUID().substring(0, 8)}`;

describe("POST /api/v1/citizens/consents - Integration Tests", async () => {
  let app: FastifyInstance;
  let setAuth: (config: MockAuthConfig) => void;
  let consentStatementId: string;
  let oldConsentStatementId: string;

  beforeAll(async () => {
    const server = await buildOnce();
    app = server.app;
    setAuth = server.setAuth;

    // Create test consent statements
    const currentDate = new Date(Date.now() - 1000);
    const oldDate = new Date(Date.now() - 2000);

    const currentStatement = await insertTestConsentStatement(pool, {
      subject: ConsentSubjects.Messaging,
      publishDate: currentDate,
      isEnabled: true,
    });
    consentStatementId = currentStatement.id;

    const oldStatement = await insertTestConsentStatement(pool, {
      subject: ConsentSubjects.Messaging,
      publishDate: oldDate,
      isEnabled: true,
    });
    oldConsentStatementId = oldStatement.id;
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

  describe("Profile validation", () => {
    it("Returns 400 if profile has different primary user id", async () => {
      const profileId = randomUUID().substring(0, 12);
      const primaryUserId = randomUUID().substring(0, 12);
      setAuth({ userId: profileId, organizationId: "organisationId" });

      await createTestProfile({
        id: profileId,
        primaryUserId,
        publicName: `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
        email: `${randomUUID().substring(0, 5)}@me.com`,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/citizens/consents",
        body: {
          consents: [
            {
              subject: ConsentSubjects.Messaging,
              status: ConsentStatuses.OptedOut,
              consentStatementId: consentStatementId,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("Returns 404 if profile does not exist", async () => {
      setAuth({
        userId: randomUUID().substring(0, 12),
        organizationId: "organisationId",
      });
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/citizens/consents",
        body: {
          consents: [
            {
              subject: ConsentSubjects.Messaging,
              status: ConsentStatuses.OptedOut,
              consentStatementId: consentStatementId,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("Schema validation", () => {
    it("Returns 422 if body is missing required fields", async () => {
      const profileId = randomUUID().substring(0, 12);
      setAuth({ userId: profileId, organizationId: "organisationId" });
      await createTestProfile({
        id: profileId,
        primaryUserId: profileId,
        publicName: `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
        email: `${randomUUID().substring(0, 5)}@me.com`,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/citizens/consents",
        body: {
          consents: [
            {
              subject: ConsentSubjects.Messaging,
              // Missing status and statementId
            },
          ],
        },
      });

      expect(response.statusCode).toBe(422); // Schema validation error
    });

    it("Returns 422 if consents array is empty", async () => {
      const profileId = randomUUID().substring(0, 12);
      setAuth({ userId: profileId, organizationId: "organisationId" });
      await createTestProfile({
        id: profileId,
        primaryUserId: profileId,
        publicName: `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
        email: `${randomUUID().substring(0, 5)}@me.com`,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/citizens/consents",
        body: {
          consents: [],
        },
      });

      expect(response.statusCode).toBe(422); // Schema validation error for empty array
    });
  });

  describe("Successful submissions", () => {
    it("Successfully submits single consent for user", async () => {
      const profileId = randomUUID().substring(0, 12);
      setAuth({ userId: profileId, organizationId: "organisationId" });
      await createTestProfile({
        id: profileId,
        primaryUserId: profileId,
        publicName: `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
        email: `${randomUUID().substring(0, 5)}@me.com`,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/citizens/consents",
        body: {
          consents: [
            {
              subject: ConsentSubjects.Messaging,
              status: ConsentStatuses.OptedIn,
              consentStatementId: consentStatementId,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].subject).toBe(ConsentSubjects.Messaging);
      expect(body.data[0].status).toBe(ConsentStatuses.OptedIn);
      expect(body.data[0].consentStatementId).toBe(consentStatementId);
      expect(body.data[0].isLatestStatement).toBe(true);
    });

    it("Successfully submits multiple consents for different categories", async () => {
      const profileId = randomUUID().substring(0, 12);
      setAuth({ userId: profileId, organizationId: "organisationId" });
      await createTestProfile({
        id: profileId,
        primaryUserId: profileId,
        publicName: `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
        email: `${randomUUID().substring(0, 5)}@me.com`,
      });

      // Create additional consent statement for different subject
      const randomSubject = generateRandomSubject();
      const additionalStatement = await insertTestConsentStatement(pool, {
        subject: randomSubject,
        publishDate: new Date(Date.now() - 1000),
        isEnabled: true,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/citizens/consents",
        body: {
          consents: [
            {
              subject: ConsentSubjects.Messaging,
              status: ConsentStatuses.OptedIn,
              consentStatementId: consentStatementId,
            },
            {
              subject: randomSubject,
              status: ConsentStatuses.OptedOut,
              consentStatementId: additionalStatement.id,
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
  });

  describe("Statement validation", () => {
    it("Returns 400 when statement is not the current active statement", async () => {
      const profileId = randomUUID().substring(0, 12);
      setAuth({ userId: profileId, organizationId: "organisationId" });
      await createTestProfile({
        id: profileId,
        primaryUserId: profileId,
        publicName: `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
        email: `${randomUUID().substring(0, 5)}@me.com`,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/citizens/consents",
        body: {
          consents: [
            {
              subject: ConsentSubjects.Messaging,
              status: ConsentStatuses.OptedIn,
              consentStatementId: randomUUID(),
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.errors).toBeDefined();
      expect(body.errors[0].errors).toContain(
        "Statement is not the current active statement for subject 'messaging'",
      );
    });

    it("Returns 400 when statement is not current for subject", async () => {
      const profileId = randomUUID().substring(0, 12);
      setAuth({ userId: profileId, organizationId: "organisationId" });
      await createTestProfile({
        id: profileId,
        primaryUserId: profileId,
        publicName: `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
        email: `${randomUUID().substring(0, 5)}@me.com`,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/citizens/consents",
        body: {
          consents: [
            {
              subject: ConsentSubjects.Messaging,
              status: ConsentStatuses.OptedIn,
              consentStatementId: oldConsentStatementId, // Using old statement
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.errors).toBeDefined();
      expect(body.errors[0].errors).toContain(
        "Statement is not the current active statement for subject 'messaging'",
      );
    });

    it("Returns 400 when statement does not belong to subject", async () => {
      const profileId = randomUUID().substring(0, 12);
      setAuth({ userId: profileId, organizationId: "organisationId" });
      await createTestProfile({
        id: profileId,
        primaryUserId: profileId,
        publicName: `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
        email: `${randomUUID().substring(0, 5)}@me.com`,
      });

      // Create statement for different subject
      const differentSubject = generateRandomSubject();
      const differentStatement = await insertTestConsentStatement(pool, {
        subject: differentSubject,
        publishDate: new Date(Date.now() - 1000),
        isEnabled: true,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/citizens/consents",
        body: {
          consents: [
            {
              subject: ConsentSubjects.Messaging,
              status: ConsentStatuses.OptedIn,
              consentStatementId: differentStatement.id, // Using statement from different subject
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.errors).toBeDefined();
      expect(body.errors[0].errors).toContain(
        "Statement is not the current active statement for subject 'messaging'",
      );
    });

    it("Returns 400 when no current statement exists for subject", async () => {
      const profileId = randomUUID().substring(0, 12);
      setAuth({ userId: profileId, organizationId: "organisationId" });
      await createTestProfile({
        id: profileId,
        primaryUserId: profileId,
        publicName: `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
        email: `${randomUUID().substring(0, 5)}@me.com`,
      });

      const nonExistentSubject = generateRandomSubject();
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/citizens/consents",
        body: {
          consents: [
            {
              subject: nonExistentSubject,
              status: ConsentStatuses.OptedIn,
              consentStatementId: randomUUID(),
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.errors).toBeDefined();
      expect(body.errors[0].errors).toContain(
        `No current active statement found for subject '${nonExistentSubject}'`,
      );
    });
  });

  describe("Status transition validation", () => {
    it("Returns 400 when status transition is invalid", async () => {
      const profileId = randomUUID().substring(0, 12);
      setAuth({ userId: profileId, organizationId: "organisationId" });
      await createTestProfile({
        id: profileId,
        primaryUserId: profileId,
        publicName: `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
        email: `${randomUUID().substring(0, 5)}@me.com`,
      });

      // First submit a consent to establish current status
      await app.inject({
        method: "POST",
        url: "/api/v1/citizens/consents",
        body: {
          consents: [
            {
              subject: ConsentSubjects.Messaging,
              status: ConsentStatuses.OptedIn,
              consentStatementId: consentStatementId,
            },
          ],
        },
      });

      // Try to submit invalid transition
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/citizens/consents",
        body: {
          consents: [
            {
              subject: ConsentSubjects.Messaging,
              status: ConsentStatuses.Pending, // Invalid: can't go from opted-in to pending
              consentStatementId: consentStatementId,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.errors).toBeDefined();
      expect(body.errors[0].errors).toContain(
        "Invalid status transition from 'opted-in' to 'pending'",
      );
    });
  });

  describe("Batch validation", () => {
    it("Validates all consents before processing any (atomicity)", async () => {
      const profileId = randomUUID().substring(0, 12);
      setAuth({ userId: profileId, organizationId: "organisationId" });
      await createTestProfile({
        id: profileId,
        primaryUserId: profileId,
        publicName: `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
        email: `${randomUUID().substring(0, 5)}@me.com`,
      });

      const invalidSubject = generateRandomSubject();
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/citizens/consents",
        body: {
          consents: [
            {
              subject: ConsentSubjects.Messaging,
              status: ConsentStatuses.OptedIn,
              consentStatementId: consentStatementId, // Valid
            },
            {
              subject: invalidSubject,
              status: ConsentStatuses.OptedIn,
              consentStatementId: randomUUID(), // Invalid
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.errors).toBeDefined();
      expect(body.errors).toHaveLength(1); // Only the invalid one should have errors
      expect(body.errors[0].subject).toBe(invalidSubject);

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
      setAuth({ userId: profileId, organizationId: "organisationId" });

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
        url: "/api/v1/citizens/consents",
        body: {
          consents: [
            {
              subject: ConsentSubjects.Messaging,
              status: ConsentStatuses.OptedOut,
              consentStatementId: consentStatementId,
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

    it("Returns 400 when trying to submit for child profile", async () => {
      const primaryProfileId = randomUUID().substring(0, 12);
      const childProfileId = randomUUID().substring(0, 12);
      setAuth({ userId: childProfileId, organizationId: "organisationId" }); // Authenticate as child profile

      await createTestProfile({
        id: primaryProfileId,
        primaryUserId: primaryProfileId,
        publicName: `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
        email: `${randomUUID().substring(0, 5)}@me.com`,
      });

      await createTestProfile({
        id: childProfileId,
        primaryUserId: primaryProfileId, // Child profile
        publicName: `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
        email: `${randomUUID().substring(0, 5)}@me.com`,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/citizens/consents",
        body: {
          consents: [
            {
              subject: ConsentSubjects.Messaging,
              status: ConsentStatuses.OptedIn,
              consentStatementId: consentStatementId,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).errors[0].errors[0]).toBe(
        "Cannot submit consent for a child profile",
      );
    });
  });
});
