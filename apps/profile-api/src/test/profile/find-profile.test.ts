import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConsentStatuses, ConsentSubjects } from "~/schemas/consents/shared.js";
import { getCurrentConsentStatement } from "~/services/consent-statements/consent-statements-service.js";
import { createUpdateProfileDetails } from "~/services/profiles/create-update-profile-details.js";
import { findProfile } from "~/services/profiles/find-profile.js";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import { updateConsentStatuses } from "~/services/profiles/sql/update-consent-statuses.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { mockDbProfiles } from "~/test/fixtures/common.js";

describe("findProfile", async () => {
  const getSampleProfile = () => ({
    ...mockDbProfiles[0],
    safeLevel: 1,
    id: randomUUID().substring(0, 12),
    email: `${randomUUID().substring(0, 5)}@example.com`,
  });

  const getTestData = (): Record<string, string> => ({
    firstName: randomUUID().substring(0, 5),
    lastName: randomUUID().substring(0, 5),
    email: `${randomUUID().substring(0, 5)}@example.com`,
    phone: randomUUID().substring(0, 5),
  });

  const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
  let client: PoolClient;
  const sampleProfile = getSampleProfile();
  const orgId = randomUUID().substring(0, 11);
  const testData = getTestData();
  let consentStatement: { id: string };

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
    consentStatement = await getCurrentConsentStatement({
      subject: ConsentSubjects.Messaging,
      client,
    });
    await updateConsentStatuses({
      client,
      profileId: created,
      consentInput: {
        subject: ConsentSubjects.Messaging,
        status: ConsentStatuses.OptedIn,
        consentStatementId: consentStatement.id,
      },
    });

    client.release();
  });

  afterAll(async () => {
    if (!pool.ended) {
      await pool.end();
    }
  });

  it("should find profile by email", async () => {
    const result = await findProfile({
      pool,
      organizationId: orgId,
      query: { email: testData.email },
      consentSubjects: [],
    });

    expect(result.id).toEqual(sampleProfile.id);
    expect(result.email).toEqual(testData.email);
    expect(result.details?.email).toEqual(testData.email);
    expect(result.consentStatuses).toBeNull();
  });

  it("should return consent statuses when requested", async () => {
    const result = await findProfile({
      pool,
      organizationId: orgId,
      query: { email: testData.email },
      consentSubjects: [ConsentSubjects.Messaging],
    });

    expect(result.id).toEqual(sampleProfile.id);
    expect(result.email).toEqual(testData.email);
    expect(result.details?.email).toEqual(testData.email);
    expect(result.consentStatuses).toEqual({
      [ConsentSubjects.Messaging]: {
        status: ConsentStatuses.OptedIn,
        consent_statement_id: consentStatement.id,
      },
    });
  });

  it("should find profile by first name", async () => {
    const result = await findProfile({
      pool,
      organizationId: orgId,
      query: { firstName: testData.firstName },
      consentSubjects: [],
    });

    expect(result.id).toEqual(sampleProfile.id);
    expect(result.email).toEqual(testData.email);
    expect(result.details?.firstName).toEqual(testData.firstName);
    expect(result.consentStatuses).toBeNull();
  });

  it("should find profile by last name", async () => {
    const result = await findProfile({
      pool,
      organizationId: orgId,
      query: { lastName: testData.lastName },
      consentSubjects: [],
    });

    expect(result.id).toEqual(sampleProfile.id);
    expect(result.email).toEqual(testData.email);
    expect(result.details?.lastName).toEqual(testData.lastName);
    expect(result.consentStatuses).toBeNull();
  });

  it("should find profile by phone", async () => {
    const result = await findProfile({
      pool,
      organizationId: orgId,
      query: { phone: testData.phone },
      consentSubjects: [],
    });

    expect(result.id).toEqual(sampleProfile.id);
    expect(result.email).toEqual(testData.email);
    expect(result.details?.phone).toEqual(testData.phone);
    expect(result.consentStatuses).toBeNull();
  });

  it("should find profile with multiple search criteria", async () => {
    const result = await findProfile({
      pool,
      organizationId: orgId,
      query: {
        email: testData.email,
        firstName: testData.firstName,
        lastName: testData.lastName,
      },
      consentSubjects: [],
    });

    expect(result.id).toEqual(sampleProfile.id);
    expect(result.email).toEqual(testData.email);
    expect(result.consentStatuses).toBeNull();
  });

  it("should find profile with multiple search criteria using substrings", async () => {
    const result = await findProfile({
      pool,
      organizationId: orgId,
      query: {
        email: testData.email.substring(1, 7),
        firstName: testData.firstName.substring(2, 4),
        lastName: testData.lastName.substring(2, 4),
      },
      consentSubjects: [],
    });

    expect(result.id).toEqual(sampleProfile.id);
    expect(result.email).toEqual(testData.email);
    expect(result.consentStatuses).toBeNull();
  });

  it("should return latest imported email", async () => {
    const testClient = await pool.connect();
    try {
      const toCreateId = randomUUID().substring(0, 12);
      const toCreate = {
        id: toCreateId,
        publicName: randomUUID().substring(0, 5),
        email: `${randomUUID().substring(0, 5)}@example.com`,
        primaryUserId: toCreateId,
      };
      const dataToInsert = {
        firstName: randomUUID().substring(0, 13),
        lastName: randomUUID().substring(0, 13),
        email: toCreate.email,
        phone: randomUUID().substring(0, 5),
      };

      await createProfile(testClient, toCreate);
      await createUpdateProfileDetails({
        client: testClient,
        organizationId: orgId,
        profileId: toCreateId,
        data: dataToInsert,
        createOnly: false,
      });
      const newEmail = `${randomUUID().substring(0, 9)}@example.com`;
      await createUpdateProfileDetails({
        client: testClient,
        organizationId: orgId,
        profileId: toCreateId,
        data: { ...dataToInsert, email: newEmail },
        createOnly: false,
      });

      const result = await findProfile({
        pool,
        organizationId: orgId,
        query: { firstName: dataToInsert.firstName },
        consentSubjects: [],
      });

      expect(result.id).toEqual(toCreateId);
      expect(result.email).toEqual(newEmail);
      expect(result.details?.email).toEqual(newEmail);
    } finally {
      testClient.release();
    }
  });

  it("should throw an error when no profile is found", async () => {
    await expect(
      findProfile({
        pool,
        organizationId: orgId,
        query: { email: `${randomUUID()}@mail.com` },
        consentSubjects: [],
      }),
    ).rejects.toThrow();
  });
});
