import type { FastifyBaseLogger } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getBuildingBlockSDK = vi.fn();
const getM2MTokenFn = vi.fn().mockReturnValue(async () => "m2m-token");

vi.mock("@ogcio/building-blocks-sdk", () => ({
  getBuildingBlockSDK: (...args: unknown[]) => getBuildingBlockSDK(...args),
  getM2MTokenFn: (...args: unknown[]) => getM2MTokenFn(...args),
}));

const logger = { debug: vi.fn() } as unknown as FastifyBaseLogger;

const buildSdkStub = () => ({
  upload: { name: "upload-sdk" },
  profile: { name: "profile-sdk" },
  scheduler: { name: "scheduler-sdk" },
  analytics: { name: "analytics-sdk" },
  featureFlags: { name: "feature-flags-sdk" },
});

const importFactory = async () =>
  await import("../../utils/authentication-factory.js");

describe("authentication factory", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    getBuildingBlockSDK.mockReset().mockImplementation(buildSdkStub);
    getM2MTokenFn.mockClear();
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("builds and caches one m2m sdk per organization", async () => {
    const factory = await importFactory();

    const first = await factory.getM2MUploadSdk(logger, "org-1");
    const again = await factory.getM2MUploadSdk(logger, "org-1");
    const other = await factory.getM2MProfileSdk(logger, "org-2");

    expect(first).toEqual({ name: "upload-sdk" });
    expect(again).toEqual(first);
    expect(other).toEqual({ name: "profile-sdk" });
    expect(getBuildingBlockSDK).toHaveBeenCalledTimes(2);
  });

  it("builds and caches the citizen sdk when no organization is given", async () => {
    const factory = await importFactory();

    const first = await factory.getM2MProfileSdk(logger);
    const again = await factory.getM2MProfileSdk(logger);

    expect(first).toEqual({ name: "profile-sdk" });
    expect(again).toEqual(first);
    expect(getBuildingBlockSDK).toHaveBeenCalledTimes(1);
  });

  it("splits analytics scopes from the environment when configured", async () => {
    process.env.LOGTO_M2M_ANALYTICS_SCOPES = "scope:a,scope:b";
    const factory = await importFactory();

    await factory.getM2MSchedulerSdk(logger, "org-1");

    const tokenConfig = getM2MTokenFn.mock.calls[0][0] as {
      services: {
        analytics: { getOrganizationTokenParams: { scopes?: string[] } };
      };
    };
    expect(
      tokenConfig.services.analytics.getOrganizationTokenParams.scopes,
    ).toEqual(["scope:a", "scope:b"]);
  });

  it("leaves analytics scopes undefined when not configured", async () => {
    delete process.env.LOGTO_M2M_ANALYTICS_SCOPES;
    const factory = await importFactory();

    await factory.getM2MSchedulerSdk(logger, "org-1");

    const tokenConfig = getM2MTokenFn.mock.calls[0][0] as {
      services: {
        analytics: { getOrganizationTokenParams: { scopes?: string[] } };
      };
    };
    expect(
      tokenConfig.services.analytics.getOrganizationTokenParams.scopes,
    ).toBeUndefined();
  });

  it("caches the analytics sdk after the first call", async () => {
    const factory = await importFactory();

    const first = await factory.getM2MAnalyticsSdk(logger);
    const again = await factory.getM2MAnalyticsSdk(logger);

    expect(first).toEqual({ name: "analytics-sdk" });
    expect(again).toEqual(first);
    expect(getBuildingBlockSDK).toHaveBeenCalledTimes(1);
  });

  it("builds a personal sdk whose token fn only serves the profile service", async () => {
    const factory = await importFactory();

    const sdk = await factory.getPersonalProfileSdk(logger, {
      userId: "user-1",
      accessToken: "personal-token",
    });

    expect(sdk).toEqual({ name: "profile-sdk" });
    const config = getBuildingBlockSDK.mock.calls[0][0] as {
      getTokenFn: (serviceName: string) => Promise<string>;
    };
    await expect(config.getTokenFn("profile")).resolves.toBe("personal-token");
    await expect(config.getTokenFn("upload")).rejects.toThrow(
      "upload is not available for personal sdks",
    );
  });

  it("builds a new personal sdk on every call", async () => {
    const factory = await importFactory();

    await factory.getPersonalProfileSdk(logger, {
      userId: "user-1",
      accessToken: "t1",
    });
    await factory.getPersonalProfileSdk(logger, {
      userId: "user-2",
      accessToken: "t2",
    });

    expect(getBuildingBlockSDK).toHaveBeenCalledTimes(2);
  });

  it("caches the feature flags client and restricts its token fn", async () => {
    const factory = await importFactory();

    const first = factory.getFeatureFlagsClient({
      url: "https://flags.example.com",
      token: "ff-token",
    });
    const again = factory.getFeatureFlagsClient({
      url: "https://other.example.com",
      token: "other-token",
    });

    expect(first).toEqual({ name: "feature-flags-sdk" });
    expect(again).toEqual(first);
    expect(getBuildingBlockSDK).toHaveBeenCalledTimes(1);

    const config = getBuildingBlockSDK.mock.calls[0][0] as {
      getTokenFn: (serviceName: string) => Promise<string>;
    };
    await expect(config.getTokenFn("featureFlags")).resolves.toBe("ff-token");
    await expect(config.getTokenFn("profile")).rejects.toThrow(
      "Wrong method invoked, featureFlags only",
    );
  });
});
