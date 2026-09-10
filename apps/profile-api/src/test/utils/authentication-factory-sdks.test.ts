import type { FastifyBaseLogger } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EnvConfig, M2MSdksConfig } from "~/plugins/external/env.js";

const getBuildingBlockSDK = vi.fn();
const getM2MTokenFn = vi.fn(
  (..._args: unknown[]) =>
    async () =>
      "m2m-token",
);
vi.mock("@ogcio/building-blocks-sdk", () => ({
  getBuildingBlockSDK: (...args: unknown[]) => getBuildingBlockSDK(...args),
  getM2MTokenFn: (...args: unknown[]) => getM2MTokenFn(...args),
}));

const logger = { debug: vi.fn() } as unknown as FastifyBaseLogger;

const buildSdkStub = () => ({
  scheduler: { tag: "scheduler" },
  analytics: { tag: "analytics" },
  auditCollector: { tag: "audit" },
  upload: { tag: "upload" },
  messaging: { tag: "messaging" },
  featureFlags: { tag: "feature-flags" },
});

const envConfig = {
  SCHEDULER_BACKEND_URL: "https://scheduler.example",
  ANALYTICS_URL: "https://analytics.example",
  ANALYTICS_MATOMO_TOKEN: "matomo",
  ANALYTICS_WEBSITE_ID: "site-1",
  ANALYTICS_DRY_RUN: false,
  LOGTO_OIDC_ENDPOINT: "https://oidc.example",
  LOGTO_M2M_SCHEDULER_APP_ID: "sched-app",
  LOGTO_M2M_SCHEDULER_APP_SECRET: "sched-secret",
  LOGTO_M2M_ANALYTICS_ORGANIZATION_ID: "analytics-org",
  LOGTO_M2M_ANALYTICS_APP_ID: "analytics-app",
  LOGTO_M2M_ANALYTICS_APP_SECRET: "analytics-secret",
  LOGTO_M2M_ANALYTICS_SCOPES: "a:read,b:write",
} as unknown as EnvConfig;

const m2mConfig = {
  AUDIT_COLLECTOR_URL: "https://audit.example",
  UPLOAD_BACKEND_URL: "https://upload.example",
  MESSAGING_BACKEND_URL: "https://messaging.example",
  LOGTO_OIDC_ENDPOINT: "https://oidc.example",
  LOGTO_M2M_LIFECYCLE_APP_ID: "lifecycle-app",
  LOGTO_M2M_LIFECYCLE_APP_SECRET: "lifecycle-secret",
} as unknown as M2MSdksConfig;

const importFactory = async () =>
  await import("~/utils/authentication-factory.js");

describe("authentication-factory sdk builders", () => {
  beforeEach(() => {
    vi.resetModules();
    getBuildingBlockSDK.mockReset().mockImplementation(buildSdkStub);
    getM2MTokenFn.mockClear();
  });

  it("builds and caches the per-organisation scheduler/analytics sdk", async () => {
    const factory = await importFactory();

    const scheduler = await factory.getOrgSchedulerSdk(
      logger,
      "org-1",
      envConfig,
    );
    const analytics = await factory.getOrgAnalyticsSdk(
      envConfig,
      logger,
      "org-1",
    );

    expect(scheduler).toEqual({ tag: "scheduler" });
    expect(analytics).toEqual({ tag: "analytics" });
    // Same org => one SDK construction, cached afterwards.
    expect(getBuildingBlockSDK).toHaveBeenCalledTimes(1);

    await factory.getOrgSchedulerSdk(logger, "org-2", envConfig);
    expect(getBuildingBlockSDK).toHaveBeenCalledTimes(2);
  });

  it("configures analytics with the configured org and split scopes", async () => {
    const factory = await importFactory();
    await factory.getOrgSchedulerSdk(logger, "org-1", envConfig);

    const sdkArgs = getBuildingBlockSDK.mock.calls[0][0];
    expect(sdkArgs.services.analytics.organizationId).toBe("analytics-org");
    expect(getM2MTokenFn).toHaveBeenCalledWith({
      services: expect.objectContaining({
        analytics: {
          getOrganizationTokenParams: expect.objectContaining({
            organizationId: "analytics-org",
            scopes: ["a:read", "b:write"],
          }),
        },
      }),
    });
  });

  it("falls back to the request org and undefined scopes when analytics envs are absent", async () => {
    const factory = await importFactory();
    const sparseConfig = {
      ...envConfig,
      ANALYTICS_URL: undefined,
      LOGTO_M2M_ANALYTICS_ORGANIZATION_ID: undefined,
      LOGTO_M2M_ANALYTICS_APP_ID: undefined,
      LOGTO_M2M_ANALYTICS_APP_SECRET: undefined,
      LOGTO_M2M_ANALYTICS_SCOPES: undefined,
    } as unknown as EnvConfig;

    await factory.getOrgSchedulerSdk(logger, "org-1", sparseConfig);

    const sdkArgs = getBuildingBlockSDK.mock.calls[0][0];
    expect(sdkArgs.services.analytics.baseUrl).toBe("");
    expect(sdkArgs.services.analytics.organizationId).toBe("org-1");
    expect(getM2MTokenFn).toHaveBeenCalledWith({
      services: expect.objectContaining({
        analytics: {
          getOrganizationTokenParams: expect.objectContaining({
            applicationId: "",
            applicationSecret: "",
            organizationId: "org-1",
            scopes: undefined,
          }),
        },
      }),
    });
  });

  it("rejects citizen requests without an organisation id", async () => {
    const factory = await importFactory();

    await expect(
      factory.getOrgSchedulerSdk(logger, "", envConfig),
    ).rejects.toMatchObject({ statusCode: 500 });
  });

  it("builds and caches the audit collector m2m sdk", async () => {
    const factory = await importFactory();

    const first = factory.getAuditCollectorSdk(m2mConfig, logger);
    const again = factory.getAuditCollectorSdk(m2mConfig, logger);

    expect(first).toEqual({ tag: "audit" });
    expect(again).toBe(first);
    expect(getBuildingBlockSDK).toHaveBeenCalledTimes(1);
  });

  it("builds and caches the lifecycle worker m2m sdk", async () => {
    const factory = await importFactory();

    const first = factory.getLifecycleWorkerM2MSdk(m2mConfig, logger);
    const again = factory.getLifecycleWorkerM2MSdk(m2mConfig, logger);

    expect(first.upload).toEqual({ tag: "upload" });
    expect(first.messaging).toEqual({ tag: "messaging" });
    expect(again.upload).toBe(first.upload);
    expect(getBuildingBlockSDK).toHaveBeenCalledTimes(1);
  });

  it("builds and caches the feature flags client", async () => {
    const factory = await importFactory();

    const first = factory.getFeatureFlagsClient({
      url: "https://ff.example",
      token: "ff-token",
    });
    const again = factory.getFeatureFlagsClient({
      url: "https://ff.example",
      token: "ff-token",
    });

    expect(first).toEqual({ tag: "feature-flags" });
    expect(again).toBe(first);
    expect(getBuildingBlockSDK).toHaveBeenCalledTimes(1);

    // The token fn only serves featureFlags.
    const { getTokenFn } = getBuildingBlockSDK.mock.calls[0][0];
    await expect(getTokenFn("featureFlags")).resolves.toBe("ff-token");
    await expect(getTokenFn("upload")).rejects.toThrow(
      "Wrong method invoked, featureFlags only",
    );
  });

  it("builds a personal upload sdk whose token fn rejects other services", async () => {
    const factory = await importFactory();

    const upload = factory.getCitizenUploadSdk({
      userData: { userId: "user-1", accessToken: "citizen-token" },
    });

    expect(upload).toEqual({ tag: "upload" });
    const { getTokenFn } = getBuildingBlockSDK.mock.calls[0][0];
    await expect(getTokenFn("upload")).resolves.toBe("citizen-token");
    await expect(getTokenFn("messaging")).rejects.toMatchObject({
      statusCode: 500,
    });
  });
});
