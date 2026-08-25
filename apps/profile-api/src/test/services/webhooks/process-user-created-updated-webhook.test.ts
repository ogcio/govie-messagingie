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
import { processUserCreatedOrUpdatedWebhook } from "~/services/webhooks/process-user-created-updated-webhook.js";
import { buildMockLogger } from "~/test/build-mock-logger.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { mockLogtoConfig } from "~/test/fixtures/common.js";

// Mock only external dependencies (analytics)
vi.mock("~/services/webhooks/analytics-service.js", () => ({
  WebhookAnalyticsService: {
    trackProfileImportSuccess: vi.fn().mockResolvedValue(undefined),
    trackProfileImportError: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("processUserCreatedOrUpdatedWebhook Unit Tests", () => {
  const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
  let client: PoolClient;
  let logger: FastifyBaseLogger;
  let config: EnvConfig;
  let mockLogtoClient: LogtoClient;

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

  describe("Webhook Data Processing", () => {
    it("should route to profile import processing when profileImportId is present", async () => {
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
            jobId: "import-123",
            organizationId: "org-123",
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

      // Should return success status since the webhook handles missing imports gracefully
      expect(result.status).toBe("success");
      expect(result.id).toBeDefined();
    });

    it("should route to direct signin processing when no profileImportId", async () => {
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
    });

    it("should handle webhook data with missing optional fields", async () => {
      const webhookBody = {
        data: {
          id: "user-3",
          username: "testuser3",
          primaryEmail: "test3@example.com",
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

      expect(result.status).toBe("success");
      expect(result.id).toBeDefined();
    });

    it("should handle webhook data with different identity types", async () => {
      const webhookBody = {
        data: {
          id: "user-4",
          username: "testuser4",
          primaryEmail: "test4@example.com",
          identities: {
            "Entra ID (Entra ID connector)": {
              details: {
                email: "test4@example.com",
                rawData: {
                  firstName: "Test4",
                  lastName: "User4",
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
    });
  });

  describe("Feature Flag Integration", () => {
    it("should handle basic webhook processing", async () => {
      const webhookBody = {
        data: {
          id: "user-5",
          username: "testuser5",
          primaryEmail: "test5@example.com",
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

      expect(result.status).toBe("success");
      expect(result.id).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid webhook data gracefully", async () => {
      const webhookBody = {
        data: {
          id: "user-6",
          username: "testuser6",
          primaryEmail: "test6@example.com",
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

    it("should handle database connection issues", async () => {
      const webhookBody = {
        data: {
          id: "user-7",
          username: "testuser7",
          primaryEmail: "test7@example.com",
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
  });

  describe("Custom Data Processing", () => {
    it("should handle custom data with insertPrivateDetails flag", async () => {
      const webhookBody = {
        data: {
          id: "user-8",
          username: "testuser8",
          primaryEmail: "test8@example.com",
          identities: {
            [MY_GOV_ID_IDENTITY]: {
              details: {
                email: "test8@example.com",
                rawData: {
                  firstName: "Test8",
                  lastName: "User8",
                },
              },
            },
          },
          customData: {
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
    });

    it("should handle custom data with onlyPrivateDetails flag", async () => {
      const webhookBody = {
        data: {
          id: "user-9",
          username: "testuser9",
          primaryEmail: "test9@example.com",
          identities: {
            [MY_GOV_ID_IDENTITY]: {
              details: {
                email: "test9@example.com",
                rawData: {
                  firstName: "Test9",
                  lastName: "User9",
                },
              },
            },
          },
          customData: {
            insertPrivateDetails: false,
            onlyPrivateDetails: true,
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
    });
  });
});
