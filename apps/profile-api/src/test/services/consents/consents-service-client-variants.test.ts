import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CascadeConsentReasons,
  ConsentStatuses,
} from "~/schemas/consents/shared.js";
import {
  getLatestConsentForUser,
  submitConsent,
  submitConsents,
  submitSupportConsents,
} from "~/services/consents/consents-service.js";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import { buildMockLogger } from "~/test/build-mock-logger.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { insertTestConsentStatement } from "~/test/insert-test-consent-statement.js";

const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
const { logger } = buildMockLogger({});

const newId = () => randomUUID().substring(0, 12);

// Exercise the explicit-client variants and profile-object overloads that the
// pool-based service tests never touch.
describe("consents-service with an explicit client", () => {
  let client: PoolClient;
  let subject: string;
  let statementId: string;

  const createTestProfile = async (id: string, primaryUserId = id) => {
    await createProfile(client, {
      id,
      primaryUserId,
      publicName: `User ${id}`,
      email: `${id}@example.com`,
    });
    return id;
  };

  beforeEach(async () => {
    client = await pool.connect();
    subject = `consents-cli-${randomUUID().substring(0, 8)}`;
    const inserted = await insertTestConsentStatement(pool, {
      subject,
      publishDate: new Date(Date.now() - 60_000),
    });
    statementId = inserted.id;
  });

  afterEach(() => {
    client?.release();
  });

  afterAll(async () => {
    if (!pool.ended) {
      await pool.end();
    }
  });

  it("submits a consent via client and cascades to linked profiles", async () => {
    const primaryId = await createTestProfile(newId());
    const linkedId = await createTestProfile(newId(), primaryId);

    const result = await submitConsent({
      client,
      logger,
      userId: primaryId,
      reason: CascadeConsentReasons.AccountLinking,
      consentInput: {
        subject,
        consentStatementId: statementId,
        status: ConsentStatuses.OptedIn,
      },
    });

    expect(result.id).toBeDefined();
    const linkedConsent = await getLatestConsentForUser({
      client,
      userId: linkedId,
      subject,
    });
    expect(linkedConsent.status).toBe(ConsentStatuses.OptedIn);
  });

  it("accepts a pre-loaded profile object", async () => {
    const profileId = await createTestProfile(newId());

    const result = await submitConsent({
      client,
      logger,
      reason: CascadeConsentReasons.AccountLinking,
      profile: {
        id: profileId,
        primaryUserId: profileId,
        publicName: `User ${profileId}`,
        email: `${profileId}@example.com`,
        linkedProfiles: [],
      } as never,
      consentInput: {
        subject,
        consentStatementId: statementId,
        status: ConsentStatuses.OptedIn,
      },
    });

    expect(result.id).toBeDefined();
  });

  it("rejects submitting a consent for a child profile", async () => {
    const primaryId = await createTestProfile(newId());
    const childId = await createTestProfile(newId(), primaryId);

    await expect(
      submitConsent({
        client,
        logger,
        userId: childId,
        reason: CascadeConsentReasons.AccountLinking,
        consentInput: {
          subject,
          consentStatementId: statementId,
          status: ConsentStatuses.OptedIn,
        },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a consent when the subject has no active statement", async () => {
    const profileId = await createTestProfile(newId());

    await expect(
      submitConsent({
        client,
        logger,
        userId: profileId,
        reason: CascadeConsentReasons.AccountLinking,
        consentInput: {
          subject: `consents-cli-none-${randomUUID().substring(0, 8)}`,
          consentStatementId: statementId,
          status: ConsentStatuses.OptedIn,
        },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("submits citizen consents via client and cascades to linked profiles", async () => {
    const primaryId = await createTestProfile(newId());
    const linkedId = await createTestProfile(newId(), primaryId);

    const response = await submitConsents({
      client,
      logger,
      userId: primaryId,
      consentInput: {
        consents: [
          {
            subject,
            consentStatementId: statementId,
            status: ConsentStatuses.OptedIn,
          },
        ],
      },
    });

    expect(response.data).toHaveLength(1);
    expect(response.errors).toBeUndefined();

    const linkedConsent = await getLatestConsentForUser({
      client,
      userId: linkedId,
      subject,
    });
    expect(linkedConsent.status).toBe(ConsentStatuses.OptedIn);
  });

  it("rejects citizen consents for a child profile via client", async () => {
    const primaryId = await createTestProfile(newId());
    const childId = await createTestProfile(newId(), primaryId);

    await expect(
      submitConsents({
        client,
        logger,
        userId: childId,
        consentInput: {
          consents: [
            {
              subject,
              consentStatementId: statementId,
              status: ConsentStatuses.OptedIn,
            },
          ],
        },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("submits support consents via client", async () => {
    const profileId = await createTestProfile(newId());

    const response = await submitSupportConsents({
      client,
      logger,
      userId: profileId,
      consentInput: {
        profileId,
        consents: [{ subject, status: ConsentStatuses.OptedOut }],
      },
    });

    expect(response.data).toHaveLength(1);
    expect(response.data[0].status).toBe(ConsentStatuses.OptedOut);
  });

  it("rejects support consents for a child profile", async () => {
    const primaryId = await createTestProfile(newId());
    const childId = await createTestProfile(newId(), primaryId);

    await expect(
      submitSupportConsents({
        client,
        logger,
        userId: childId,
        consentInput: {
          profileId: childId,
          consents: [{ subject, status: ConsentStatuses.OptedOut }],
        },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("fetches latest consents for multiple subjects via client", async () => {
    const profileId = await createTestProfile(newId());
    await submitConsent({
      client,
      logger,
      userId: profileId,
      reason: CascadeConsentReasons.AccountLinking,
      consentInput: {
        subject,
        consentStatementId: statementId,
        status: ConsentStatuses.OptedIn,
      },
    });

    const consents = await getLatestConsentForUser({
      client,
      userId: profileId,
      subjects: [subject, `consents-cli-empty-${randomUUID().substring(0, 8)}`],
    });

    expect(Array.isArray(consents)).toBe(true);
    expect(consents).toHaveLength(1);
  });
});
