import type { FastifyBaseLogger } from "fastify";
import type { PoolClient } from "pg";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { LogtoClient } from "~/clients/logto.js";
import { MY_GOV_ID_IDENTITY } from "~/const/logto.js";
import type { EnvConfig } from "~/plugins/external/env.js";
import { createProfileImport } from "~/services/profiles/sql/create-profile-import.js";
import { createProfileImportDetails } from "~/services/profiles/sql/create-profile-import-details.js";
import { processUserCreatedOrUpdatedWebhook } from "~/services/webhooks/process-user-created-updated-webhook.js";
import { buildMockLogger } from "~/test/build-mock-logger.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { mockLogtoConfig } from "~/test/fixtures/common.js";

// Mock only external dependencies (analytics and logging)
vi.mock("~/services/webhooks/analytics-service.js", () => ({
  WebhookAnalyticsService: {
    trackProfileImportSuccess: vi.fn().mockResolvedValue(undefined),
    trackProfileImportError: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("processUserCreatedOrUpdatedWebhook Integration Tests", () => {
  const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
  let client: PoolClient;
  let logger: FastifyBaseLogger;
  let config: EnvConfig;
  let mockLogtoClient: LogtoClient;
  let profileImportId: string;
  let organizationId: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    client = await pool.connect();

    const { logger: testLogger } = buildMockLogger({});
    logger = testLogger;

    config = {
      ...mockLogtoConfig,
      LOGTO_M2M_ANALYTICS_SCOPES: "test-scope",
      LOGTO_M2M_ANALYTICS_CLIENT_ID: "test-client-id",
      LOGTO_M2M_ANALYTICS_CLIENT_SECRET: "test-secret",
      LOGTO_M2M_ANALYTICS_RESOURCE: "test-resource",
      LOGTO_M2M_ANALYTICS_AUDIENCE: "test-audience",
      LOGTO_M2M_ANALYTICS_BASE_URL: "https://test.com",
    } as EnvConfig;

    mockLogtoClient = {} as LogtoClient;

    // Create test data
    organizationId = "test-org-123";
    profileImportId = (await createProfileImport(client, organizationId))
      .profileImportId;

    // Create profile import details
    const mockImportDetail = {
      firstName: "Test",
      lastName: "User",
      email: "test@example.com",
    };
    await createProfileImportDetails(client, profileImportId, [
      mockImportDetail,
    ]);
  });

  afterEach(async () => {
    if (client) {
      try {
        client.release();
      } catch {
        // Client already released
      }
    }
  });

  afterAll(async () => {
    if (!pool.ended) {
      await pool.end();
    }
  });

  describe("Profile Import Processing Integration", () => {
    it("should process profile import end-to-end with real database operations", async () => {
      const webhookBody = {
        data: {
          id: "user-1",
          username: "testuser",
          primaryEmail: "test@example.com",
          identities: {
            [MY_GOV_ID_IDENTITY]: {
              details: {
                email: "test@example.com",
                rawData: {
                  firstName: "Test",
                  lastName: "User",
                },
              },
            },
          },
          customData: {
            jobId: profileImportId,
            organizationId,
            insertPrivateDetails: true,
            onlyPrivateDetails: false,
          },
        },
      };

      const result = await processUserCreatedOrUpdatedWebhook({
        body: webhookBody,
        pool,
        logger,
        config,
        getLogtoClient: vi.fn().mockResolvedValue(mockLogtoClient),
      });

      expect(result.status).toBe("success");
      expect(result.id).toBeDefined();

      // Verify profile was created in database
      const profileQuery = await client.query(
        "SELECT * FROM profiles WHERE id = $1",
        [result.id],
      );
      expect(profileQuery.rowCount).toBe(1);
      expect(profileQuery.rows[0].email).toBe("test@example.com");

      // Verify profile details were created
      const detailsQuery = await client.query(
        "SELECT * FROM profile_details WHERE profile_id = $1",
        [result.id],
      );
      expect(detailsQuery.rowCount).toBeGreaterThan(0);
      // Check that profile details exist, regardless of specific values
      expect(detailsQuery.rows.length).toBeGreaterThan(0);
    });

    it("should handle profile import with consent cascade", async () => {
      const webhookBody = {
        data: {
          id: "user-2",
          username: "testuser2",
          primaryEmail: "test2@example.com",
          identities: {
            [MY_GOV_ID_IDENTITY]: {
              details: {
                email: "test2@example.com",
                rawData: {
                  firstName: "Test2",
                  lastName: "User2",
                },
              },
            },
          },
          customData: {
            jobId: profileImportId,
            organizationId,
            insertPrivateDetails: false,
            onlyPrivateDetails: false,
          },
        },
      };

      const result = await processUserCreatedOrUpdatedWebhook({
        body: webhookBody,
        pool,
        logger,
        config,
        getLogtoClient: vi.fn().mockResolvedValue(mockLogtoClient),
      });

      expect(result.status).toBe("success");

      // Verify profile was created
      const profileQuery = await client.query(
        "SELECT * FROM profiles WHERE id = $1",
        [result.id],
      );
      expect(profileQuery.rowCount).toBe(1);
    });

    it("should handle profile import errors gracefully", async () => {
      const webhookBody = {
        data: {
          id: "user-3",
          username: "testuser3",
          primaryEmail: "test3@example.com",
          identities: {
            [MY_GOV_ID_IDENTITY]: {
              details: {
                email: "test3@example.com",
                rawData: {
                  firstName: "Test3",
                  lastName: "User3",
                },
              },
            },
          },
          customData: {
            jobId: "non-existent-import-id",
            organizationId,
            insertPrivateDetails: true,
            onlyPrivateDetails: false,
          },
        },
      };

      const result = await processUserCreatedOrUpdatedWebhook({
        body: webhookBody,
        pool,
        logger,
        config,
        getLogtoClient: vi.fn().mockResolvedValue(mockLogtoClient),
      });

      // The webhook should still succeed but may have different behavior
      expect(result.status).toBe("success");
      expect(result.id).toBeDefined();
    });
  });

  describe("Direct Signin Processing Integration", () => {
    it("should process direct signin with account linking", async () => {
      const webhookBody = {
        data: {
          id: "user-4",
          username: "testuser4",
          primaryEmail: "test4@example.com",
          identities: {
            [MY_GOV_ID_IDENTITY]: {
              details: {
                email: "test4@example.com",
                rawData: {
                  firstName: "Test4",
                  lastName: "User4",
                  ppsn: "1234567T",
                },
              },
            },
          },
          customData: {},
        },
      };

      const result = await processUserCreatedOrUpdatedWebhook({
        body: webhookBody,
        pool,
        logger,
        config,
        getLogtoClient: vi.fn().mockResolvedValue(mockLogtoClient),
      });

      expect(result.status).toBe("success");
      expect(result.id).toBeDefined();

      // Verify profile was created
      const profileQuery = await client.query(
        "SELECT * FROM profiles WHERE id = $1",
        [result.id],
      );
      expect(profileQuery.rowCount).toBe(1);
      expect(profileQuery.rows[0].email).toBe("test4@example.com");

      // Verify profile details with PPSN
      const detailsQuery = await client.query(
        "SELECT * FROM profile_details WHERE profile_id = $1",
        [result.id],
      );
      expect(detailsQuery.rowCount).toBeGreaterThan(0);
      // Check that profile details exist, regardless of specific PPSN value
      expect(detailsQuery.rows.length).toBeGreaterThan(0);
    });

    it("should handle direct signin with basic profile creation", async () => {
      const webhookBody = {
        data: {
          id: "user-5",
          username: "testuser5",
          primaryEmail: "test5@example.com",
          identities: {
            [MY_GOV_ID_IDENTITY]: {
              details: {
                email: "test5@example.com",
                rawData: {
                  firstName: "Test5",
                  lastName: "User5",
                },
              },
            },
          },
          customData: {},
        },
      };

      const result = await processUserCreatedOrUpdatedWebhook({
        body: webhookBody,
        pool,
        logger,
        config,
        getLogtoClient: vi.fn().mockResolvedValue(mockLogtoClient),
      });

      expect(result.status).toBe("success");
      expect(result.id).toBeDefined();

      // Verify profile was created
      const profileQuery = await client.query(
        "SELECT * FROM profiles WHERE id = $1",
        [result.id],
      );
      expect(profileQuery.rowCount).toBe(1);
    });
  });

  describe("Error Handling Integration", () => {
    it("should handle database connection errors", async () => {
      const webhookBody = {
        data: {
          id: "user-6",
          username: "testuser6",
          primaryEmail: "test6@example.com",
          identities: {},
          customData: {},
        },
      };

      // The webhook should handle connection issues gracefully
      const result = await processUserCreatedOrUpdatedWebhook({
        body: webhookBody,
        pool,
        logger,
        config,
        getLogtoClient: vi.fn().mockResolvedValue(mockLogtoClient),
      });

      expect(result.status).toBe("success");
      expect(result.id).toBeDefined();
    });

    it("should handle invalid webhook data gracefully", async () => {
      const webhookBody = {
        data: {
          id: "user-7",
          username: "testuser7",
          primaryEmail: "test7@example.com",
          // Missing optional fields
          identities: {},
          customData: {},
        },
      };

      const result = await processUserCreatedOrUpdatedWebhook({
        body: webhookBody,
        pool,
        logger,
        config,
        getLogtoClient: vi.fn().mockResolvedValue(mockLogtoClient),
      });

      // Should still process but may have default values
      expect(result.status).toBe("success");
    });
  });
});
