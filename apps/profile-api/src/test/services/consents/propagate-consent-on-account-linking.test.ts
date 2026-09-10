import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ConsentStatementWithTranslations } from "~/schemas/consent-statements/shared.js";
import {
  CascadeConsentReasons,
  ConsentStatuses,
} from "~/schemas/consents/shared.js";
import { getConsentStatementById } from "~/services/consent-statements/consent-statements-service.js";
import {
  getLatestConsentForUser,
  propagateConsentOnAccountLinking,
  submitConsent,
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

describe("propagateConsentOnAccountLinking", () => {
  let client: PoolClient;
  // Suite-private random subject: never assert against globally shared rows.
  let subject: string;
  let statement: ConsentStatementWithTranslations;

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
    subject = `cascade-${randomUUID().substring(0, 8)}`;
    const inserted = await insertTestConsentStatement(pool, {
      subject,
      publishDate: new Date(Date.now() - 60_000),
    });
    statement = await getConsentStatementById({
      pool,
      id: inserted.id,
    });
  });

  afterEach(() => {
    client?.release();
  });

  afterAll(async () => {
    if (!pool.ended) {
      await pool.end();
    }
  });

  it("submits an undefined consent for the primary when none is set and cascades to the linked profile", async () => {
    const primaryId = await createTestProfile(newId());
    const linkedId = await createTestProfile(newId(), primaryId);

    await propagateConsentOnAccountLinking({
      client,
      logger,
      currentConsentStatement: statement,
      reason: CascadeConsentReasons.AccountLinking,
      primaryProfileId: primaryId,
      childProfileId: linkedId,
    });

    const primaryConsent = await getLatestConsentForUser({
      client,
      userId: primaryId,
      subject,
    });
    expect(primaryConsent.status).toBe(ConsentStatuses.Undefined);
  });

  it("copies the primary's existing consent to the linked profile", async () => {
    const primaryId = await createTestProfile(newId());
    const linkedId = await createTestProfile(newId(), primaryId);

    await submitConsent({
      client,
      logger,
      userId: primaryId,
      reason: CascadeConsentReasons.AccountLinking,
      consentInput: {
        subject,
        consentStatementId: statement.id,
        status: ConsentStatuses.OptedIn,
      },
    });

    await propagateConsentOnAccountLinking({
      client,
      logger,
      currentConsentStatement: statement,
      reason: CascadeConsentReasons.AccountLinking,
      primaryProfileId: primaryId,
      childProfileId: linkedId,
    });

    const linkedConsent = await getLatestConsentForUser({
      client,
      userId: linkedId,
      subject,
    });
    expect(linkedConsent.status).toBe(ConsentStatuses.OptedIn);

    // Running the cascade again is a no-op (already propagated).
    await expect(
      propagateConsentOnAccountLinking({
        client,
        logger,
        currentConsentStatement: statement,
        reason: CascadeConsentReasons.AccountLinking,
        primaryProfileId: primaryId,
        childProfileId: linkedId,
      }),
    ).resolves.toBeUndefined();
  });

  it("skips the cascade when the primary is itself a child profile", async () => {
    const realPrimaryId = await createTestProfile(newId());
    const childAsPrimaryId = await createTestProfile(newId(), realPrimaryId);
    const linkedId = await createTestProfile(newId(), childAsPrimaryId);

    await propagateConsentOnAccountLinking({
      client,
      logger,
      currentConsentStatement: statement,
      reason: CascadeConsentReasons.AccountLinking,
      primaryProfileId: childAsPrimaryId,
      childProfileId: linkedId,
    });

    await expect(
      getLatestConsentForUser({ client, userId: linkedId, subject }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("skips the cascade when the linked profile belongs to a different primary", async () => {
    const primaryId = await createTestProfile(newId());
    const otherPrimaryId = await createTestProfile(newId());
    const linkedToOtherId = await createTestProfile(newId(), otherPrimaryId);

    await propagateConsentOnAccountLinking({
      client,
      logger,
      currentConsentStatement: statement,
      reason: CascadeConsentReasons.AccountLinking,
      primaryProfileId: primaryId,
      childProfileId: linkedToOtherId,
    });

    await expect(
      getLatestConsentForUser({ client, userId: linkedToOtherId, subject }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("accepts pre-loaded profile objects instead of ids", async () => {
    const primaryId = await createTestProfile(newId());
    const linkedId = await createTestProfile(newId(), primaryId);
    const asProfile = (id: string, primaryUserId: string) =>
      ({
        id,
        primaryUserId,
        publicName: `User ${id}`,
        email: `${id}@example.com`,
        linkedProfiles: [],
      }) as never;

    await propagateConsentOnAccountLinking({
      client,
      logger,
      currentConsentStatement: statement,
      reason: CascadeConsentReasons.AccountLinking,
      primaryProfile: asProfile(primaryId, primaryId),
      childProfile: asProfile(linkedId, primaryId),
    });

    const primaryConsent = await getLatestConsentForUser({
      client,
      userId: primaryId,
      subject,
    });
    expect(primaryConsent.status).toBe(ConsentStatuses.Undefined);
  });

  it("rethrows when a referenced profile does not exist", async () => {
    await expect(
      propagateConsentOnAccountLinking({
        client,
        logger,
        currentConsentStatement: statement,
        reason: CascadeConsentReasons.AccountLinking,
        primaryProfileId: "missing-p",
        childProfileId: "missing-c",
      }),
    ).rejects.toThrow();
  });
});
