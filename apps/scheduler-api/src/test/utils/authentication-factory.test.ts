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
  analytics: { name: "analytics-sdk" },
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

  it("builds the analytics sdk and caches it at module level", async () => {
    const factory = await importFactory();

    const first = await factory.getM2MAnalyticsSdk(logger);
    const again = await factory.getM2MAnalyticsSdk(logger);

    expect(first).toEqual({ name: "analytics-sdk" });
    expect(again).toBe(first);
    expect(getBuildingBlockSDK).toHaveBeenCalledTimes(1);
  });

  it("configures the sdk from analytics environment variables", async () => {
    process.env.ANALYTICS_URL = "https://analytics.example";
    process.env.ANALYTICS_MATOMO_TOKEN = "matomo-token";
    process.env.ANALYTICS_WEBSITE_ID = "site-1";
    process.env.LOGTO_M2M_ANALYTICS_ORGANIZATION_ID = "org-1";
    process.env.LOGTO_M2M_ANALYTICS_APP_ID = "app-1";
    process.env.LOGTO_M2M_ANALYTICS_APP_SECRET = "shhh";
    process.env.LOGTO_OIDC_ENDPOINT = "https://oidc.example";
    process.env.LOGTO_M2M_ANALYTICS_SCOPES = "a:b,c:d";
    process.env.ANALYTICS_DRY_RUN = "true";

    const factory = await importFactory();
    await factory.getM2MAnalyticsSdk(logger);

    expect(getBuildingBlockSDK).toHaveBeenCalledWith(
      expect.objectContaining({
        services: {
          analytics: expect.objectContaining({
            baseUrl: "https://analytics.example",
            matomoToken: "matomo-token",
            trackingWebsiteId: "site-1",
            organizationId: "org-1",
            dryRun: true,
          }),
        },
      }),
    );
    expect(getM2MTokenFn).toHaveBeenCalledWith({
      services: {
        analytics: {
          getOrganizationTokenParams: expect.objectContaining({
            applicationId: "app-1",
            applicationSecret: "shhh",
            logtoOidcEndpoint: "https://oidc.example",
            organizationId: "org-1",
            scopes: ["a:b", "c:d"],
          }),
        },
      },
    });
  });

  it("defaults to empty strings and undefined scopes when env is unset", async () => {
    delete process.env.ANALYTICS_URL;
    delete process.env.LOGTO_M2M_ANALYTICS_ORGANIZATION_ID;
    delete process.env.LOGTO_M2M_ANALYTICS_SCOPES;
    delete process.env.ANALYTICS_DRY_RUN;

    const factory = await importFactory();
    await factory.getM2MAnalyticsSdk(logger);

    const [config] = getBuildingBlockSDK.mock.calls[0];
    expect(config.services.analytics.baseUrl).toBe("");
    expect(config.services.analytics.dryRun).toBe(false);
    const [tokenConfig] = getM2MTokenFn.mock.calls[0];
    expect(
      tokenConfig.services.analytics.getOrganizationTokenParams.scopes,
    ).toBeUndefined();
  });
});
