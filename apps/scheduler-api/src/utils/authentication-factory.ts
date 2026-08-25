import {
  type BuildingBlocksSDK,
  type DefinedServices,
  getBuildingBlockSDK,
  getM2MTokenFn,
  type TokenFunction,
} from "@ogcio/building-blocks-sdk";
import type { FastifyBaseLogger } from "fastify";

const sdkPerOrganisation: { [organizationId: string]: SetupSdks } = {};
let analytics: BuildingBlocksSDK["analytics"] | undefined;

type SetupSdks = DefinedServices<{
  services: {
    analytics?: {
      baseUrl: string;
    };
  };
  getTokenFn: TokenFunction;
}>;

export const getM2MAnalyticsSdk = async (
  logger: FastifyBaseLogger,
): Promise<BuildingBlocksSDK["analytics"]> => {
  if (analytics) return analytics;

  analytics = loadBuildingBlocksSdk(
    process.env.LOGTO_M2M_ANALYTICS_ORGANIZATION_ID ?? "",
    logger,
  ).analytics;
  return analytics;
};

const loadBuildingBlocksSdk = (
  organizationId: string,
  logger?: FastifyBaseLogger,
): SetupSdks => {
  if (!sdkPerOrganisation[organizationId]) {
    sdkPerOrganisation[organizationId] = getBuildingBlockSDK({
      services: {
        analytics: {
          baseUrl: process.env.ANALYTICS_URL ?? "",
          matomoToken: process.env.ANALYTICS_MATOMO_TOKEN,
          trackingWebsiteId: process.env.ANALYTICS_WEBSITE_ID,
          organizationId: process.env.LOGTO_M2M_ANALYTICS_ORGANIZATION_ID,
          dryRun:
            process.env.ANALYTICS_DRY_RUN === "true" ||
            process.env.ANALYTICS_DRY_RUN === "1",
        },
      },
      getTokenFn: getM2MTokenFn({
        services: {
          analytics: {
            getOrganizationTokenParams: {
              applicationId: process.env.LOGTO_M2M_ANALYTICS_APP_ID ?? "",
              applicationSecret:
                process.env.LOGTO_M2M_ANALYTICS_APP_SECRET ?? "",
              logtoOidcEndpoint: process.env.LOGTO_OIDC_ENDPOINT ?? "",
              organizationId:
                process.env.LOGTO_M2M_ANALYTICS_ORGANIZATION_ID ??
                organizationId,
              scopes: process.env.LOGTO_M2M_ANALYTICS_SCOPES
                ? process.env.LOGTO_M2M_ANALYTICS_SCOPES.split(",")
                : undefined,
            },
          },
        },
      }),
      logger,
    });
  }

  return sdkPerOrganisation[organizationId];
};
