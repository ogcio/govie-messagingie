import type { FastifyBaseLogger } from "fastify";
import type { Pool, PoolClient } from "pg";
import { describe, expect, it } from "vitest";
import type { LogtoClient } from "~/clients/logto.js";
import type { EnvConfig } from "~/plugins/external/env.js";
import type { ConsentStatementWithTranslations } from "~/schemas/consent-statements/shared.js";
import type { ConsentSubject } from "~/schemas/consents/shared.js";
import type { LogtoUserCreatedBody } from "~/schemas/webhooks/logto-user-created.js";
import type {
  AccountLinkingParams,
  ConsentProcessingParams,
  DirectSigninParams,
  ProfileCreationData,
  ProfileImportParams,
  WebhookProcessingParams,
  WebhookResponse,
} from "~/services/webhooks/types.js";
import type { WebhookUser } from "~/services/webhooks/webhook-body-to-user.js";

describe("Webhook Types", () => {
  describe("WebhookResponse", () => {
    it("should have correct structure for success response", () => {
      const successResponse: WebhookResponse = {
        id: "test-id",
        status: "success",
      };

      expect(successResponse.id).toBe("test-id");
      expect(successResponse.status).toBe("success");
      expect(successResponse.error).toBeUndefined();
    });

    it("should have correct structure for error response", () => {
      const errorResponse: WebhookResponse = {
        id: undefined,
        status: "error",
        error: "Something went wrong",
      };

      expect(errorResponse.id).toBeUndefined();
      expect(errorResponse.status).toBe("error");
      expect(errorResponse.error).toBe("Something went wrong");
    });
  });

  describe("WebhookProcessingParams", () => {
    it("should have correct structure", () => {
      const mockBody: LogtoUserCreatedBody = {
        event: "user.created",
        data: {
          id: "user-123",
          username: null,
          primaryEmail: "test@example.com",
          name: "Test User",
          customData: {
            profileImportId: null,
            organizationId: null,
            insertPrivateDetails: false,
            onlyPrivateDetails: false,
          },
          identities: {},
        },
      };

      const mockPool = {} as Pool;
      const mockLogger = {} as FastifyBaseLogger;
      const mockConfig = {} as EnvConfig;
      const mockGetLogtoClient = async (): Promise<LogtoClient> =>
        ({}) as LogtoClient;

      const params: WebhookProcessingParams = {
        body: mockBody,
        pool: mockPool,
        logger: mockLogger,
        config: mockConfig,
        getLogtoClient: mockGetLogtoClient,
      };

      expect(params.body).toBe(mockBody);
      expect(params.pool).toBe(mockPool);
      expect(params.logger).toBe(mockLogger);
      expect(params.config).toBe(mockConfig);
      expect(typeof params.getLogtoClient).toBe("function");
    });
  });

  describe("ProfileImportParams", () => {
    it("should have correct structure", () => {
      const mockUser: WebhookUser = {
        id: "user-123",
        email: "test@example.com",
        primaryUserId: "user-123",
        createdAt: "2023-01-01T00:00:00Z",
        consentStatusOnDirectSignin: "pending",
      };

      const mockPool = {} as Pool;
      const mockLogger = {} as FastifyBaseLogger;
      const mockConfig = {} as EnvConfig;
      const mockConsentStatement: ConsentStatementWithTranslations = {
        id: "consent-123",
        subject: "messaging",
        version: 1,
        createdAt: "2023-01-01T00:00:00Z",
        publishDate: "2023-01-01T00:00:00Z",
        isEnabled: true,
        createdBy: "test",
        translations: {
          en: {
            id: "trans-en-123",
            consentStatementId: "consent-123",
            title: "English Title",
            description: "English Description",
            disclaimer: "English Disclaimer",
            language: "en",
            createdAt: "2023-01-01T00:00:00Z",
          },
          ga: {
            id: "trans-ga-123",
            consentStatementId: "consent-123",
            title: "Irish Title",
            description: "Irish Description",
            disclaimer: "Irish Disclaimer",
            language: "ga",
            createdAt: "2023-01-01T00:00:00Z",
          },
        },
      };

      const params: ProfileImportParams = {
        user: mockUser,
        pool: mockPool,
        logger: mockLogger,
        config: mockConfig,
        insertPrivateDetails: true,
        onlyPrivateDetails: false,
        currentConsentStatement: mockConsentStatement,
      };

      expect(params.user).toBe(mockUser);
      expect(params.pool).toBe(mockPool);
      expect(params.logger).toBe(mockLogger);
      expect(params.config).toBe(mockConfig);
      expect(params.insertPrivateDetails).toBe(true);
      expect(params.onlyPrivateDetails).toBe(false);
      expect(params.currentConsentStatement).toBe(mockConsentStatement);
    });
  });

  describe("DirectSigninParams", () => {
    it("should have correct structure", () => {
      const mockUser: WebhookUser = {
        id: "user-123",
        email: "test@example.com",
        primaryUserId: "user-123",
        createdAt: "2023-01-01T00:00:00Z",
        consentStatusOnDirectSignin: "pending",
      };

      const mockPool = {} as Pool;
      const mockLogger = {} as FastifyBaseLogger;
      const mockConsentStatement: ConsentStatementWithTranslations = {
        id: "consent-123",
        subject: "messaging",
        version: 1,
        createdAt: "2023-01-01T00:00:00Z",
        publishDate: "2023-01-01T00:00:00Z",
        isEnabled: true,
        createdBy: "test",
        translations: {
          en: {
            id: "trans-en-123",
            consentStatementId: "consent-123",
            title: "English Title",
            description: "English Description",
            disclaimer: "English Disclaimer",
            language: "en",
            createdAt: "2023-01-01T00:00:00Z",
          },
          ga: {
            id: "trans-ga-123",
            consentStatementId: "consent-123",
            title: "Irish Title",
            description: "Irish Description",
            disclaimer: "Irish Disclaimer",
            language: "ga",
            createdAt: "2023-01-01T00:00:00Z",
          },
        },
      };
      const mockGetLogtoClient = async (): Promise<LogtoClient> =>
        ({}) as LogtoClient;

      const params: DirectSigninParams = {
        user: mockUser,
        pool: mockPool,
        logger: mockLogger,
        currentConsentStatement: mockConsentStatement,
        getLogtoClient: mockGetLogtoClient,
        isFlagEnabled: true,
      };

      expect(params.user).toBe(mockUser);
      expect(params.pool).toBe(mockPool);
      expect(params.logger).toBe(mockLogger);
      expect(params.currentConsentStatement).toBe(mockConsentStatement);
      expect(typeof params.getLogtoClient).toBe("function");
      expect(params.isFlagEnabled).toBe(true);
    });
  });

  describe("ConsentProcessingParams", () => {
    it("should have correct structure", () => {
      const mockClient = {} as PoolClient;
      const mockLogger = {} as FastifyBaseLogger;
      const mockConsentStatement: ConsentStatementWithTranslations = {
        id: "consent-123",
        subject: "messaging",
        version: 1,
        createdAt: "2023-01-01T00:00:00Z",
        publishDate: "2023-01-01T00:00:00Z",
        isEnabled: true,
        createdBy: "test",
        translations: {
          en: {
            id: "trans-en-123",
            consentStatementId: "consent-123",
            title: "English Title",
            description: "English Description",
            disclaimer: "English Disclaimer",
            language: "en",
            createdAt: "2023-01-01T00:00:00Z",
          },
          ga: {
            id: "trans-ga-123",
            consentStatementId: "consent-123",
            title: "Irish Title",
            description: "Irish Description",
            disclaimer: "Irish Disclaimer",
            language: "ga",
            createdAt: "2023-01-01T00:00:00Z",
          },
        },
      };

      const params: ConsentProcessingParams = {
        client: mockClient,
        subject: "messaging" as ConsentSubject,
        userId: "user-123",
        logger: mockLogger,
        currentConsentStatement: mockConsentStatement,
        isFlagEnabled: true,
      };

      expect(params.client).toBe(mockClient);
      expect(params.subject).toBe("messaging");
      expect(params.userId).toBe("user-123");
      expect(params.logger).toBe(mockLogger);
      expect(params.currentConsentStatement).toBe(mockConsentStatement);
      expect(params.isFlagEnabled).toBe(true);
    });
  });

  describe("AccountLinkingParams", () => {
    it("should have correct structure", () => {
      const mockClient = {} as PoolClient;
      const mockLogger = {} as FastifyBaseLogger;
      const mockConsentStatement: ConsentStatementWithTranslations = {
        id: "consent-123",
        subject: "messaging",
        version: 1,
        createdAt: "2023-01-01T00:00:00Z",
        publishDate: "2023-01-01T00:00:00Z",
        isEnabled: true,
        createdBy: "test",
        translations: {
          en: {
            id: "trans-en-123",
            consentStatementId: "consent-123",
            title: "English Title",
            description: "English Description",
            disclaimer: "English Disclaimer",
            language: "en",
            createdAt: "2023-01-01T00:00:00Z",
          },
          ga: {
            id: "trans-ga-123",
            consentStatementId: "consent-123",
            title: "Irish Title",
            description: "Irish Description",
            disclaimer: "Irish Disclaimer",
            language: "ga",
            createdAt: "2023-01-01T00:00:00Z",
          },
        },
      };

      const params: AccountLinkingParams = {
        client: mockClient,
        primaryUserId: "primary-123",
        linkedProfileId: "linked-456",
        logger: mockLogger,
        currentConsentStatement: mockConsentStatement,
      };

      expect(params.client).toBe(mockClient);
      expect(params.primaryUserId).toBe("primary-123");
      expect(params.linkedProfileId).toBe("linked-456");
      expect(params.logger).toBe(mockLogger);
      expect(params.currentConsentStatement).toBe(mockConsentStatement);
    });
  });

  describe("ProfileCreationData", () => {
    it("should have correct structure with all fields", () => {
      const profileData: ProfileCreationData = {
        id: "profile-123",
        email: "test@example.com",
        publicName: "Test User",
        primaryUserId: "primary-123",
        safeLevel: 1,
      };

      expect(profileData.id).toBe("profile-123");
      expect(profileData.email).toBe("test@example.com");
      expect(profileData.publicName).toBe("Test User");
      expect(profileData.primaryUserId).toBe("primary-123");
      expect(profileData.safeLevel).toBe(1);
    });

    it("should have correct structure with optional fields", () => {
      const profileData: ProfileCreationData = {
        id: "profile-123",
        email: "test@example.com",
        publicName: "Test User",
      };

      expect(profileData.id).toBe("profile-123");
      expect(profileData.email).toBe("test@example.com");
      expect(profileData.publicName).toBe("Test User");
      expect(profileData.primaryUserId).toBeUndefined();
      expect(profileData.safeLevel).toBeUndefined();
    });
  });
});
