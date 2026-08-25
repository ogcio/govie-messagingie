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
import { ImportStatuses } from "~/const/profile.js";
import type { ConsentStatementWithTranslations } from "~/schemas/consent-statements/shared.js";
import { ConsentSubjects } from "~/schemas/consents/shared.js";
import { createProfileImport } from "~/services/profiles/sql/create-profile-import.js";
import { createProfileImportDetails } from "~/services/profiles/sql/create-profile-import-details.js";
import * as webhookAnalyticsService from "~/services/webhooks/analytics-service.js";
import { WebhookProfileImportService } from "~/services/webhooks/profile-import-service.js";
import type { WebhookUser } from "~/services/webhooks/webhook-body-to-user.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { mockLogger, mockLogtoConfig } from "~/test/fixtures/common.js";

// Mock only external dependencies (analytics service)
vi.mock("~/services/webhooks/analytics-service.js");

describe("WebhookProfileImportService", () => {
  const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
  let client: PoolClient;
  let mockConsentStatement: ConsentStatementWithTranslations;
  let mockUser: WebhookUser;
  let profileImportId: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    client = await pool.connect();

    // Create a real profile import for testing
    const orgId = "test-org-123";
    profileImportId = (await createProfileImport(client, orgId))
      .profileImportId;

    // Get the real consent statement for testing
    const { getCurrentConsentStatement } = await import(
      "~/services/consent-statements/consent-statements-service.js"
    );
    const realConsentStatement = await getCurrentConsentStatement({
      pool,
      subject: ConsentSubjects.Messaging,
    });

    mockConsentStatement = {
      id: realConsentStatement.id,
      subject: ConsentSubjects.Messaging,
      version: 1,
      createdAt: new Date().toISOString(),
      publishDate: new Date().toISOString(),
      isEnabled: true,
      createdBy: "test-user",
      translations: {
        en: {
          id: "trans-en-1",
          createdAt: new Date().toISOString(),
          consentStatementId: realConsentStatement.id,
          title: "Test",
          description: "Test",
          disclaimer: "Test",
          language: "en" as const,
        },
        ga: {
          id: "trans-ga-1",
          createdAt: new Date().toISOString(),
          consentStatementId: realConsentStatement.id,
          title: "Test",
          description: "Test",
          disclaimer: "Test",
          language: "ga" as const,
        },
      },
    };

    const userId = `u${Math.random().toString(36).substring(2, 12)}`;
    mockUser = {
      id: userId,
      email: "test@example.com",
      primaryUserId: userId,
      createdAt: new Date().toISOString(),
      profileImportId,
      organizationId: "test-org-123",
      details: {
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
      },
      consentStatusOnDirectSignin: "pending",
    };

    // Mock analytics service calls
    vi.mocked(
      webhookAnalyticsService.WebhookAnalyticsService.trackProfileImportSuccess,
    ).mockResolvedValue();
    vi.mocked(
      webhookAnalyticsService.WebhookAnalyticsService.trackProfileImportError,
    ).mockResolvedValue();
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

  describe("processProfileImport", () => {
    it("should successfully process profile import with consent cascade", async () => {
      // Create real import details
      const mockImportDetail = {
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
      };
      await createProfileImportDetails(client, profileImportId, [
        mockImportDetail,
      ]);

      const result = await WebhookProfileImportService.processProfileImport({
        client,
        user: mockUser,
        logger: mockLogger,
        config: mockLogtoConfig,
        insertPrivateDetails: true,
        onlyPrivateDetails: false,
        currentConsentStatement: mockConsentStatement,
      });

      expect(result.status).toBe("success");
      expect(result.profileId).toBeDefined();

      expect(
        webhookAnalyticsService.WebhookAnalyticsService
          .trackProfileImportSuccess,
      ).toHaveBeenCalledWith({
        config: mockLogtoConfig,
        organizationId: mockUser.organizationId,
        email: mockUser.email,
        logger: mockLogger,
      });
    });

    it("should throw error when profileImportId is missing", async () => {
      const userWithoutImportId = { ...mockUser, profileImportId: undefined };

      await expect(
        WebhookProfileImportService.processProfileImport({
          client,
          user: userWithoutImportId,
          logger: mockLogger,
          config: mockLogtoConfig,
          insertPrivateDetails: true,
          onlyPrivateDetails: false,
          currentConsentStatement: mockConsentStatement,
        }),
      ).rejects.toThrow("no profile import found");
    });

    it("should throw error when organizationId is missing", async () => {
      const userWithoutOrgId = { ...mockUser, organizationId: undefined };
      const mockImportDetail = {
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
      };

      // Create real import details
      await createProfileImportDetails(client, profileImportId, [
        mockImportDetail,
      ]);

      await expect(
        WebhookProfileImportService.processProfileImport({
          client,
          user: userWithoutOrgId,
          logger: mockLogger,
          config: mockLogtoConfig,
          insertPrivateDetails: true,
          onlyPrivateDetails: false,
          currentConsentStatement: mockConsentStatement,
        }),
      ).rejects.toThrow("organization ID is required");
    });
  });

  describe("handleImportError", () => {
    it("should handle import error and track analytics", async () => {
      // Create real import details
      const mockImportDetail = {
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
      };
      await createProfileImportDetails(client, profileImportId, [
        mockImportDetail,
      ]);

      const mockError = new Error("Import failed");

      const result = await WebhookProfileImportService.handleImportError({
        client,
        user: mockUser,
        logger: mockLogger,
        config: mockLogtoConfig,
        error: mockError,
      });

      expect(result.status).toBe("error");
      expect(result.error).toBe("Import failed");

      expect(mockLogger.error).toHaveBeenCalledWith(
        `${mockUser.profileImportId} [Webhook] | Error: ${mockError}`,
      );
      expect(
        webhookAnalyticsService.WebhookAnalyticsService.trackProfileImportError,
      ).toHaveBeenCalledWith({
        config: mockLogtoConfig,
        organizationId: mockUser.organizationId,
        email: mockUser.email,
        logger: mockLogger,
      });
    });

    it("should handle import error when profileImportId is missing", async () => {
      const userWithoutImportId = { ...mockUser, profileImportId: undefined };
      const mockError = new Error("Import failed");

      const result = await WebhookProfileImportService.handleImportError({
        client,
        user: userWithoutImportId,
        logger: mockLogger,
        config: mockLogtoConfig,
        error: mockError,
      });

      expect(result.status).toBe("error");
      expect(result.error).toBe("Import failed");

      expect(
        webhookAnalyticsService.WebhookAnalyticsService.trackProfileImportError,
      ).toHaveBeenCalledWith({
        config: mockLogtoConfig,
        organizationId: mockUser.organizationId,
        email: mockUser.email,
        logger: mockLogger,
      });
    });
  });

  describe("updateImportStatus", () => {
    it("should update import status and check completion", async () => {
      // Create real import details
      const mockImportDetail = {
        firstName: "Test",
        lastName: "User",
        email: "test@example.com",
      };
      const importDetailIds = await createProfileImportDetails(
        client,
        profileImportId,
        [mockImportDetail],
      );

      await WebhookProfileImportService.updateImportStatus(
        client,
        importDetailIds[0],
        mockLogger,
        profileImportId,
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        `${profileImportId} [Webhook] | ${importDetailIds[0]} | ${ImportStatuses.COMPLETED.toUpperCase()}`,
      );
    });
  });
});
