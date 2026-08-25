import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { EnvConfig } from "~/plugins/external/env.js";
import { WebhookAnalyticsService } from "~/services/webhooks/analytics-service.js";
import { mockLogger, mockLogtoConfig } from "~/test/fixtures/common.js";

// Mock the authentication factory
vi.mock("~/utils/authentication-factory.js", () => ({
  getOrgAnalyticsSdk: vi.fn(),
}));

describe("WebhookAnalyticsService", () => {
  const mockAnalyticsSdk = {
    track: {
      event: vi.fn(),
    },
  };

  // biome-ignore lint/suspicious/noExplicitAny: Test setup
  let mockGetOrgAnalyticsSdk: any;

  beforeAll(async () => {
    const { getOrgAnalyticsSdk } = await import(
      "~/utils/authentication-factory.js"
    );
    mockGetOrgAnalyticsSdk = vi.mocked(getOrgAnalyticsSdk);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // biome-ignore lint/suspicious/noExplicitAny: Test setup
    (mockGetOrgAnalyticsSdk as any).mockResolvedValue(mockAnalyticsSdk);
    // Reset the track.event mock to default behavior
    mockAnalyticsSdk.track.event.mockReset();
  });

  describe("trackProfileImportSuccess", () => {
    it("should track profile import success with organization ID", async () => {
      const params = {
        config: mockLogtoConfig,
        logger: mockLogger,
        organizationId: "org-123",
        email: "test@example.com",
      };

      await WebhookAnalyticsService.trackProfileImportSuccess(params);

      expect(mockGetOrgAnalyticsSdk).toHaveBeenCalledWith(
        mockLogtoConfig,
        mockLogger,
        "org-123",
      );

      expect(mockAnalyticsSdk.track.event).toHaveBeenCalledWith({
        event: {
          category: expect.any(String),
          action: expect.any(String),
          name: expect.stringContaining("(success)"),
          value: 1,
        },
        contextOverride: {
          customDimensions: {
            organizationId: "org-123",
            email: "test@example.com",
          },
        },
      });
    });

    it("should track profile import success without organization ID", async () => {
      const params = {
        config: mockLogtoConfig,
        logger: mockLogger,
        organizationId: undefined,
        email: "test@example.com",
      };

      await WebhookAnalyticsService.trackProfileImportSuccess(params);

      expect(mockGetOrgAnalyticsSdk).toHaveBeenCalledWith(
        mockLogtoConfig,
        mockLogger,
        undefined,
      );

      expect(mockAnalyticsSdk.track.event).toHaveBeenCalledWith({
        event: {
          category: expect.any(String),
          action: expect.any(String),
          name: expect.stringContaining("(success)"),
          value: 1,
        },
        contextOverride: {
          customDimensions: {
            organizationId: null,
            email: "test@example.com",
          },
        },
      });
    });

    it("should handle analytics SDK errors gracefully", async () => {
      const params = {
        config: mockLogtoConfig,
        logger: mockLogger,
        organizationId: "org-123",
        email: "test@example.com",
      };

      mockGetOrgAnalyticsSdk.mockRejectedValue(
        new Error("Analytics SDK error"),
      );

      await expect(
        WebhookAnalyticsService.trackProfileImportSuccess(params),
      ).rejects.toThrow("Analytics SDK error");
    });

    it("should handle analytics tracking errors gracefully", async () => {
      const params = {
        config: mockLogtoConfig,
        logger: mockLogger,
        organizationId: "org-123",
        email: "test@example.com",
      };

      mockAnalyticsSdk.track.event.mockImplementation(() => {
        throw new Error("Tracking failed");
      });

      await expect(
        WebhookAnalyticsService.trackProfileImportSuccess(params),
      ).rejects.toThrow("Tracking failed");
    });
  });

  describe("trackProfileImportError", () => {
    it("should track profile import error with organization ID", async () => {
      const params = {
        config: mockLogtoConfig,
        logger: mockLogger,
        organizationId: "org-123",
        email: "test@example.com",
      };

      await WebhookAnalyticsService.trackProfileImportError(params);

      expect(mockGetOrgAnalyticsSdk).toHaveBeenCalledWith(
        mockLogtoConfig,
        mockLogger,
        "org-123",
      );

      expect(mockAnalyticsSdk.track.event).toHaveBeenCalledWith({
        event: {
          category: expect.any(String),
          action: expect.any(String),
          name: expect.stringContaining("(error)"),
          value: 0,
        },
        contextOverride: {
          customDimensions: {
            organizationId: "org-123",
            email: "test@example.com",
          },
        },
      });
    });

    it("should track profile import error without organization ID", async () => {
      const params = {
        config: mockLogtoConfig,
        logger: mockLogger,
        organizationId: undefined,
        email: "test@example.com",
      };

      await WebhookAnalyticsService.trackProfileImportError(params);

      expect(mockGetOrgAnalyticsSdk).toHaveBeenCalledWith(
        mockLogtoConfig,
        mockLogger,
        undefined,
      );

      expect(mockAnalyticsSdk.track.event).toHaveBeenCalledWith({
        event: {
          category: expect.any(String),
          action: expect.any(String),
          name: expect.stringContaining("(error)"),
          value: 0,
        },
        contextOverride: {
          customDimensions: {
            organizationId: null,
            email: "test@example.com",
          },
        },
      });
    });

    it("should handle analytics SDK errors gracefully", async () => {
      const params = {
        config: mockLogtoConfig,
        logger: mockLogger,
        organizationId: "org-123",
        email: "test@example.com",
      };

      mockGetOrgAnalyticsSdk.mockRejectedValue(
        new Error("Analytics SDK error"),
      );

      await expect(
        WebhookAnalyticsService.trackProfileImportError(params),
      ).rejects.toThrow("Analytics SDK error");
    });

    it("should handle analytics tracking errors gracefully", async () => {
      const params = {
        config: mockLogtoConfig,
        logger: mockLogger,
        organizationId: "org-123",
        email: "test@example.com",
      };

      mockAnalyticsSdk.track.event.mockImplementation(() => {
        throw new Error("Tracking failed");
      });

      await expect(
        WebhookAnalyticsService.trackProfileImportError(params),
      ).rejects.toThrow("Tracking failed");
    });
  });

  describe("Event properties", () => {
    it("should use correct event properties for success tracking", async () => {
      const params = {
        config: mockLogtoConfig,
        logger: mockLogger,
        organizationId: "org-123",
        email: "test@example.com",
      };

      await WebhookAnalyticsService.trackProfileImportSuccess(params);

      const callArgs = mockAnalyticsSdk.track.event.mock.calls[0][0];
      expect(callArgs.event.value).toBe(1);
      expect(callArgs.event.name).toContain("(success)");
    });

    it("should use correct event properties for error tracking", async () => {
      const params = {
        config: mockLogtoConfig,
        logger: mockLogger,
        organizationId: "org-123",
        email: "test@example.com",
      };

      await WebhookAnalyticsService.trackProfileImportError(params);

      const callArgs = mockAnalyticsSdk.track.event.mock.calls[0][0];
      expect(callArgs.event.value).toBe(0);
      expect(callArgs.event.name).toContain("(error)");
    });

    it("should include correct custom dimensions", async () => {
      const params = {
        config: mockLogtoConfig,
        logger: mockLogger,
        organizationId: "org-123",
        email: "test@example.com",
      };

      await WebhookAnalyticsService.trackProfileImportSuccess(params);

      const callArgs = mockAnalyticsSdk.track.event.mock.calls[0][0];
      expect(callArgs.contextOverride.customDimensions).toEqual({
        organizationId: "org-123",
        email: "test@example.com",
      });
    });
  });

  describe("Configuration handling", () => {
    it("should pass configuration correctly to analytics SDK", async () => {
      const customConfig: EnvConfig = {
        ...mockLogtoConfig,
        ANALYTICS_URL: "https://custom-analytics.com",
        ANALYTICS_WEBSITE_ID: "custom-website-id",
      };

      const params = {
        config: customConfig,
        logger: mockLogger,
        organizationId: "org-123",
        email: "test@example.com",
      };

      await WebhookAnalyticsService.trackProfileImportSuccess(params);

      expect(mockGetOrgAnalyticsSdk).toHaveBeenCalledWith(
        customConfig,
        mockLogger,
        "org-123",
      );
    });

    it("should handle different logger configurations", async () => {
      const customLogger = {
        ...mockLogger,
        level: "error",
      };

      const params = {
        config: mockLogtoConfig,
        logger: customLogger,
        organizationId: "org-123",
        email: "test@example.com",
      };

      await WebhookAnalyticsService.trackProfileImportSuccess(params);

      expect(mockGetOrgAnalyticsSdk).toHaveBeenCalledWith(
        mockLogtoConfig,
        customLogger,
        "org-123",
      );
    });
  });
});
