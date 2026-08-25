import type { PoolClient } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ConsentStatementWithTranslations } from "~/schemas/consent-statements/shared.js";
import {
  CascadeConsentReasons,
  ConsentStatuses,
  ConsentSubjects,
} from "~/schemas/consents/shared.js";
import { getCurrentConsentStatement } from "~/services/consent-statements/consent-statements-service.js";
import { submitConsent } from "~/services/consents/consents-service.js";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import { WebhookConsentService } from "~/services/webhooks/consent-service.js";
import { buildMockLogger } from "~/test/build-mock-logger.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { mockDbProfiles } from "~/test/fixtures/common.js";

describe("WebhookConsentService", () => {
  const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
  let client: PoolClient;
  let consentStatement: ConsentStatementWithTranslations;
  let testProfileId: string;
  let logger: ReturnType<typeof buildMockLogger>["logger"];

  beforeEach(async () => {
    client = await pool.connect();

    const mockLogger = buildMockLogger({});
    logger = mockLogger.logger;

    // Get the existing consent statement for testing
    consentStatement = await getCurrentConsentStatement({
      pool,
      subject: ConsentSubjects.Messaging,
    });

    // Create a test profile with shorter ID and matching primaryUserId
    const profileId = `test-${Math.random().toString(36).substring(2, 8)}`;
    const testProfile = {
      ...mockDbProfiles[0],
      id: profileId,
      primaryUserId: profileId, // Ensure both id and primaryUserId match
      email: `test-${Math.random().toString(36).substring(2, 8)}@example.com`,
      safeLevel: 1,
    };
    testProfileId = await createProfile(client, testProfile);
  });

  afterEach(() => {
    if (client) {
      client.release();
    }
  });

  afterAll(async () => {
    if (!pool.ended) {
      await pool.end();
    }
  });

  describe("isLatestConsentUndefined", () => {
    it("should return true when no consent exists for user", async () => {
      const result = await WebhookConsentService.isLatestConsentUndefined({
        client,
        subject: ConsentSubjects.Messaging,
        userId: testProfileId,
      });

      expect(result).toBe(true);
    });

    it("should return true when consent status is Undefined", async () => {
      // First submit an undefined consent
      await submitConsent({
        client,
        userId: testProfileId,
        consentInput: {
          subject: ConsentSubjects.Messaging,
          status: ConsentStatuses.Undefined,
          consentStatementId: consentStatement.id,
        },
        logger,
        reason: CascadeConsentReasons.FirstImport,
      });

      const result = await WebhookConsentService.isLatestConsentUndefined({
        client,
        subject: ConsentSubjects.Messaging,
        userId: testProfileId,
      });

      expect(result).toBe(true);
    });

    it("should return false when consent status is not Undefined", async () => {
      // Submit an opted-in consent
      await submitConsent({
        client,
        userId: testProfileId,
        consentInput: {
          subject: ConsentSubjects.Messaging,
          status: ConsentStatuses.OptedIn,
          consentStatementId: consentStatement.id,
        },
        logger,
        reason: CascadeConsentReasons.FirstImport,
      });

      const result = await WebhookConsentService.isLatestConsentUndefined({
        client,
        subject: ConsentSubjects.Messaging,
        userId: testProfileId,
      });

      expect(result).toBe(false);
    });
  });

  describe("hasPreviousConsent", () => {
    it("should return false when no consent exists", async () => {
      const result = await WebhookConsentService.hasPreviousConsent({
        client,
        subject: ConsentSubjects.Messaging,
        userId: testProfileId,
      });

      expect(result.hasPreviousConsent).toBe(false);
    });

    it("should return true when consent exists", async () => {
      // Submit a consent
      await submitConsent({
        client,
        userId: testProfileId,
        consentInput: {
          subject: ConsentSubjects.Messaging,
          status: ConsentStatuses.OptedIn,
          consentStatementId: consentStatement.id,
        },
        logger,
        reason: CascadeConsentReasons.FirstImport,
      });

      const result = await WebhookConsentService.hasPreviousConsent({
        client,
        subject: ConsentSubjects.Messaging,
        userId: testProfileId,
      });

      expect(result.hasPreviousConsent).toBe(true);
      expect(Object.keys(result)).toContain("status");
      if (result.hasPreviousConsent) {
        expect(result.status).toBe(ConsentStatuses.OptedIn);
      }
    });
  });

  describe("submitConsentForImport", () => {
    it("should submit undefined consent for new profile", async () => {
      await WebhookConsentService.submitConsentForImport({
        client,
        userId: testProfileId,
        didAlreadyExist: false,
        logger,
        currentConsentStatement: consentStatement,
      });

      // Verify consent was submitted
      const result = await WebhookConsentService.hasPreviousConsent({
        client,
        subject: ConsentSubjects.Messaging,
        userId: testProfileId,
      });

      expect(result.hasPreviousConsent).toBe(true);
    });

    it("should not submit consent when no consent statement provided", async () => {
      await WebhookConsentService.submitConsentForImport({
        client,
        userId: testProfileId,
        didAlreadyExist: false,
        logger,
        currentConsentStatement: null,
      });

      // Verify no consent was submitted
      const result = await WebhookConsentService.hasPreviousConsent({
        client,
        subject: ConsentSubjects.Messaging,
        userId: testProfileId,
      });

      expect(result.hasPreviousConsent).toBe(false);
    });
  });

  describe("submitConsentForDirectSignin", () => {
    it("should submit undefined consent when no previous consent exists", async () => {
      await WebhookConsentService.submitConsentForDirectSignin({
        client,
        userId: testProfileId,
        consentStatementId: consentStatement.id,
        logger,
        consentStatus: ConsentStatuses.Undefined,
      });

      // Verify undefined consent was submitted
      const isUndefined = await WebhookConsentService.isLatestConsentUndefined({
        client,
        subject: ConsentSubjects.Messaging,
        userId: testProfileId,
      });

      expect(isUndefined).toBe(true);
    });

    it("should not submit consent when previous consent exists", async () => {
      // Submit initial consent
      await submitConsent({
        client,
        userId: testProfileId,
        consentInput: {
          subject: ConsentSubjects.Messaging,
          status: ConsentStatuses.OptedIn,
          consentStatementId: consentStatement.id,
        },
        logger,
        reason: CascadeConsentReasons.FirstImport,
      });

      await WebhookConsentService.submitConsentForDirectSignin({
        client,
        userId: testProfileId,
        consentStatementId: consentStatement.id,
        logger,
        consentStatus: ConsentStatuses.Undefined,
      });

      // Verify original consent status is maintained
      const isUndefined = await WebhookConsentService.isLatestConsentUndefined({
        client,
        subject: ConsentSubjects.Messaging,
        userId: testProfileId,
      });

      expect(isUndefined).toBe(false);
    });
  });
});
