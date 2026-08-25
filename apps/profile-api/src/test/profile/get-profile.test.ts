import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CascadeConsentReasons,
  ConsentStatuses,
  ConsentSubjects,
} from "~/schemas/consents/shared.js";
import { getCurrentConsentStatement } from "~/services/consent-statements/consent-statements-service.js";
import { submitConsent } from "~/services/consents/consents-service.js";
import { createUpdateProfileDetails } from "~/services/profiles/create-update-profile-details.js";
import { getProfile } from "~/services/profiles/get-profile.js";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { mockDbProfiles, mockLogger } from "~/test/fixtures/common.js";

describe("getProfile", () => {
  const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
  let client: PoolClient;
  const profileId = randomUUID().substring(0, 12);
  const sampleProfile = {
    ...mockDbProfiles[0],
    id: profileId,
    email: `${randomUUID().substring(0, 5)}@example.com`,
    safeLevel: 1,
    primaryUserId: profileId, // Ensure it's its own primary user
  };
  const orgId = randomUUID().substring(0, 11);
  const testData = {
    firstName: randomUUID().substring(0, 5),
    lastName: randomUUID().substring(0, 5),
    email: `${randomUUID().substring(0, 5)}@example.com`,
    phone: randomUUID().substring(0, 5),
  };

  beforeAll(async () => {
    client = await pool.connect();
    const created = await createProfile(client, sampleProfile);
    await createUpdateProfileDetails({
      client,
      organizationId: orgId,
      profileId: created,
      data: testData,
      createOnly: false,
    });

    // Get a consent statement and submit consent using the new system
    const messagingStatement = await getCurrentConsentStatement({
      subject: ConsentSubjects.Messaging,
      pool,
    });
    await submitConsent({
      userId: created,
      logger: mockLogger,
      consentInput: {
        subject: ConsentSubjects.Messaging,
        status: ConsentStatuses.OptedIn,
        consentStatementId: messagingStatement.id,
      },
      pool: pool,
      reason: CascadeConsentReasons.FirstImport,
    });

    client.release();
  });

  afterAll(async () => {
    if (!pool.ended) {
      await pool.end();
    }
  });

  it("should get profile by id with organization id", async () => {
    const result = await getProfile({
      pool,
      organizationId: orgId,
      profileId: sampleProfile.id,
      addLinkedProfiles: false,
      consentSubjects: [],
    });
    expect(result.id).toEqual(sampleProfile.id);
    expect(result.email).toEqual(testData.email);
    expect(result.details?.email).toEqual(testData.email);
    expect(result.consentStatuses).toBeNull();
  });

  it("should get profile by id without organization id", async () => {
    const result = await getProfile({
      pool,
      organizationId: undefined,
      profileId: sampleProfile.id,
      addLinkedProfiles: false,
      consentSubjects: [],
    });
    expect(result.id).toEqual(sampleProfile.id);
    expect(result.email).toEqual(sampleProfile.email);
    expect(result.consentStatuses).toBeNull();
  });

  it("should return enhanced consent statuses when requested", async () => {
    const result = await getProfile({
      pool,
      organizationId: orgId,
      profileId: sampleProfile.id,
      addLinkedProfiles: false,
      consentSubjects: [ConsentSubjects.Messaging],
    });
    expect(result.id).toEqual(sampleProfile.id);
    expect(result.email).toEqual(testData.email);
    expect(result.consentStatuses).toEqual({
      [ConsentSubjects.Messaging]: {
        subject: ConsentSubjects.Messaging,
        status: ConsentStatuses.OptedIn,
        submittedAt: expect.any(String),
        statementId: expect.any(String),
        statementVersion: expect.any(Number),
        isLatestStatement: expect.any(Boolean),
      },
    });
  });

  it("should return null consent statuses when no consent subjects requested", async () => {
    const result = await getProfile({
      pool,
      organizationId: orgId,
      profileId: sampleProfile.id,
      addLinkedProfiles: false,
      consentSubjects: [],
    });
    expect(result.id).toEqual(sampleProfile.id);
    expect(result.email).toEqual(testData.email);
    expect(result.consentStatuses).toBeNull();
  });

  it("should return null consent statuses when consent subjects requested but none exist", async () => {
    const result = await getProfile({
      pool,
      organizationId: orgId,
      profileId: sampleProfile.id,
      addLinkedProfiles: false,
      consentSubjects: ["nonexistent-subject"],
    });
    expect(result.id).toEqual(sampleProfile.id);
    expect(result.email).toEqual(testData.email);
    expect(result.consentStatuses).toBeNull();
  });

  it("should handle empty consent subjects array", async () => {
    const result = await getProfile({
      pool,
      organizationId: orgId,
      profileId: sampleProfile.id,
      addLinkedProfiles: false,
      consentSubjects: [],
    });
    expect(result.id).toEqual(sampleProfile.id);
    expect(result.consentStatuses).toBeNull();
  });

  it("should raise an error when profile is not found", async () => {
    await expect(
      getProfile({
        pool,
        organizationId: orgId,
        profileId: "nonexistent-profile",
        addLinkedProfiles: false,
        consentSubjects: [],
      }),
    ).rejects.toThrow();
  });
});
