import type { PoolClient } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ConsentStatementWithTranslations } from "~/schemas/consent-statements/shared.js";
import {
  CascadeConsentReasons,
  ConsentStatuses,
  ConsentSubjects,
} from "~/schemas/consents/shared.js";
import { getCurrentConsentStatement } from "~/services/consent-statements/consent-statements-service.js";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import { WebhookConsentService } from "~/services/webhooks/consent-service.js";
import { WebhookProfileService } from "~/services/webhooks/profile-service.js";
import { buildMockLogger } from "~/test/build-mock-logger.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";

describe("Account Linking with Consent Cascade", () => {
  const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
  let client: PoolClient;
  let logger: ReturnType<typeof buildMockLogger>["logger"];
  let consentStatement: ConsentStatementWithTranslations;

  beforeEach(async () => {
    client = await pool.connect();
    const mockLogger = buildMockLogger({});
    logger = mockLogger.logger;

    // Get the existing consent statement for testing
    consentStatement = await getCurrentConsentStatement({
      pool,
      subject: ConsentSubjects.Messaging,
    });
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

  describe("Account linking scenarios", () => {
    it("should properly cascade consent when linking accounts", async () => {
      // Create shorter IDs to fit database constraints (varchar(12))
      const interimUserId = `int${Math.random().toString(36).substring(2, 6)}`;
      const primaryUserId = `pri${Math.random().toString(36).substring(2, 6)}`;
      const testPpsn = `${Math.floor(Math.random() * 9000000) + 1000000}T`;

      // Create interim user (represents imported profile)
      await createProfile(client, {
        id: interimUserId,
        primaryUserId: interimUserId,
        email: `int${Math.random().toString(36).substring(2, 6)}@example.com`,
        publicName: "Interim User",
        safeLevel: 1,
      });

      // Add PPSN data for interim user
      const { rows: detailRows } = await client.query(
        "INSERT INTO profile_details (profile_id, is_latest, organisation_id) VALUES ($1, true, 'test-org') RETURNING id",
        [interimUserId],
      );

      await client.query(
        "INSERT INTO profile_data (profile_details_id, name, value_type, value) VALUES ($1, 'ppsn', 'string', $2), ($1, 'external_id', 'string', 'ext-123')",
        [detailRows[0].id, testPpsn],
      );

      // Create primary user (represents logged-in user)
      await createProfile(client, {
        id: primaryUserId,
        primaryUserId: primaryUserId,
        email: `pri${Math.random().toString(36).substring(2, 6)}@example.com`,
        publicName: "Primary User",
        safeLevel: 0,
      });

      // Test the account linking process
      const interimUser = await WebhookProfileService.findInterimUserByPpsn(
        client,
        testPpsn,
      );

      expect(interimUser).toBeTruthy();
      if (interimUser) {
        expect(interimUser.id).toBe(interimUserId);
      }

      // Link the interim user to the primary user
      await WebhookProfileService.linkInterimUser(
        client,
        interimUserId,
        primaryUserId,
      );

      // Verify the linking worked
      const { rows: linkedRows } = await client.query(
        "SELECT primary_user_id FROM profiles WHERE id = $1",
        [interimUserId],
      );
      expect(linkedRows[0].primary_user_id).toBe(primaryUserId);

      // Test consent cascade
      await WebhookConsentService.cascadeConsentOnAccountLinking({
        client,
        primaryUserId,
        linkedProfileId: interimUserId,
        logger,
        currentConsentStatement: consentStatement,
      });

      // Verify both profiles have consent records
      const { rows: primaryConsentRows } = await client.query(
        "SELECT status, subject FROM profile_consents WHERE profile_id = $1 ORDER BY created_at DESC LIMIT 1",
        [primaryUserId],
      );

      const { rows: linkedConsentRows } = await client.query(
        "SELECT status, subject, cascade_reason FROM profile_consents WHERE profile_id = $1 ORDER BY created_at DESC LIMIT 1",
        [interimUserId],
      );

      expect(primaryConsentRows).toHaveLength(1);
      expect(primaryConsentRows[0].status).toBe(ConsentStatuses.Undefined);
      expect(primaryConsentRows[0].subject).toBe(ConsentSubjects.Messaging);

      expect(linkedConsentRows).toHaveLength(1);
      expect(linkedConsentRows[0].status).toBe(ConsentStatuses.Undefined);
      expect(linkedConsentRows[0].subject).toBe(ConsentSubjects.Messaging);
      expect(linkedConsentRows[0].cascade_reason).toBe(
        CascadeConsentReasons.AccountLinking,
      );
    });
  });

  describe("Profile linking queries", () => {
    it("should find interim user by PPSN with correct criteria", async () => {
      const testPpsn = `${Math.floor(Math.random() * 9000000) + 1000000}T`;
      const interimUserId = `int${Math.random().toString(36).substring(2, 6)}`;

      // Create interim user
      await createProfile(client, {
        id: interimUserId,
        primaryUserId: interimUserId,
        email: `int${Math.random().toString(36).substring(2, 6)}@example.com`,
        publicName: "Interim User",
        safeLevel: 1,
      });

      // Add the required profile details and data
      const { rows: detailRows } = await client.query(
        "INSERT INTO profile_details (profile_id, is_latest, organisation_id) VALUES ($1, true, 'test-org') RETURNING id",
        [interimUserId],
      );

      await client.query(
        "INSERT INTO profile_data (profile_details_id, name, value_type, value) VALUES ($1, 'ppsn', 'string', $2), ($1, 'external_id', 'string', 'ext-123')",
        [detailRows[0].id, testPpsn],
      );

      const result = await WebhookProfileService.findInterimUserByPpsn(
        client,
        testPpsn,
      );

      expect(result).toBeTruthy();
      if (result) {
        expect(result.id).toBe(interimUserId);
        expect(result.primary_user_id).toBe(interimUserId);
      }
    });

    it("should not find interim user without external_id", async () => {
      const testPpsn = `${Math.floor(Math.random() * 9000000) + 1000000}T`;
      const interimUserId = `int${Math.random().toString(36).substring(2, 6)}`;

      // Create interim user
      await createProfile(client, {
        id: interimUserId,
        primaryUserId: interimUserId,
        email: `int${Math.random().toString(36).substring(2, 6)}@example.com`,
        publicName: "Interim User",
        safeLevel: 1,
      });

      // Add profile details but no external_id
      const { rows: detailRows } = await client.query(
        "INSERT INTO profile_details (profile_id, is_latest, organisation_id) VALUES ($1, true, 'test-org') RETURNING id",
        [interimUserId],
      );

      await client.query(
        "INSERT INTO profile_data (profile_details_id, name, value_type, value) VALUES ($1, 'ppsn', 'string', $2)",
        [detailRows[0].id, testPpsn],
      );

      const result = await WebhookProfileService.findInterimUserByPpsn(
        client,
        testPpsn,
      );

      expect(result).toBeNull();
    });
  });
});
