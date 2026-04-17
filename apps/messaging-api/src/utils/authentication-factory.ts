import { httpErrors } from "@fastify/sensible";
import {
  type BuildingBlocksSDK,
  type DefinedServices,
  getBuildingBlockSDK,
  getM2MTokenFn,
  type TokenFunction,
} from "@ogcio/building-blocks-sdk";
import type { FastifyBaseLogger } from "fastify";

let featureFlags: BuildingBlocksSDK["featureFlags"] | undefined;

type SetupSdks = DefinedServices<{
  services: {
    scheduler: {
      baseUrl: string;
    };
    profile: {
      baseUrl: string;
    };
    upload: {
      baseUrl: string;
    };
    analytics?: {
      baseUrl: string;
    };
  };
  getTokenFn: TokenFunction;
}>;

const trimSlash = (input: string) => {
  let i = input.length;
  while (i-- && input.charAt(i) === "/");
  return input.substring(0, i + 1);
};

const profileBackendUrl = `${trimSlash(process.env.PROFILE_BACKEND_URL ?? "")}/`;
let analytics: BuildingBlocksSDK["analytics"] | undefined;
const organizationM2MSdk: { [organizationId: string]: SetupSdks } = {};
let citizenM2MSdk: SetupSdks | undefined;

const getBaseProfileConfig = (): {
  logtoOidcEndpoint: string;
  applicationId: string;
  applicationSecret: string;
} => ({
  logtoOidcEndpoint: process.env.LOGTO_OIDC_ENDPOINT ?? "",
  applicationId: process.env.LOGTO_M2M_PROFILE_APP_ID ?? "",
  applicationSecret: process.env.LOGTO_M2M_PROFILE_APP_SECRET ?? "",
});

const getBaseOnboardingConfig = (): {
  logtoOidcEndpoint: string;
  applicationId: string;
  applicationSecret: string;
} => ({
  logtoOidcEndpoint: process.env.LOGTO_OIDC_ENDPOINT ?? "",
  applicationId: process.env.LOGTO_M2M_ONBOARDING_APP_ID ?? "",
  applicationSecret: process.env.LOGTO_M2M_ONBOARDING_APP_SECRET ?? "",
});

const loadM2MSdk = (
  organizationId?: string,
  logger?: FastifyBaseLogger,
): SetupSdks => {
  if (!organizationId) {
    if (!citizenM2MSdk) {
      citizenM2MSdk = getBuildingBlockSDK({
        services: {
          scheduler: {
            baseUrl: process.env.SCHEDULER_BACKEND_URL ?? "",
          },
          profile: {
            baseUrl: process.env.PROFILE_BACKEND_URL ?? "",
          },
          upload: {
            baseUrl: process.env.UPLOAD_BACKEND_URL ?? "",
          },
          analytics: {
            baseUrl: process.env.ANALYTICS_URL ?? "",
            organizationId: process.env.LOGTO_M2M_ANALYTICS_ORGANIZATION_ID,
            trackingWebsiteId: process.env.ANALYTICS_WEBSITE_ID,
            matomoToken: process.env.ANALYTICS_MATOMO_TOKEN,
            dryRun: !!process.env.ANALYTICS_DRY_RUN,
          },
        },
        getTokenFn: getM2MTokenFn({
          services: {
            profile: {
              getAccessTokenParams: {
                resource: profileBackendUrl,
                scopes: ["profile:user.onboarding:read"],
                ...getBaseOnboardingConfig(),
              },
            },
          },
        }),
        logger,
      });
    }
    return citizenM2MSdk;
  }

  if (!organizationM2MSdk[organizationId]) {
    organizationM2MSdk[organizationId] = getBuildingBlockSDK({
      services: {
        scheduler: {
          baseUrl: process.env.SCHEDULER_BACKEND_URL ?? "",
        },
        profile: {
          baseUrl: process.env.PROFILE_BACKEND_URL ?? "",
        },
        upload: {
          baseUrl: process.env.UPLOAD_BACKEND_URL ?? "",
        },
        analytics: {
          baseUrl: process.env.ANALYTICS_URL ?? "",
          matomoToken: process.env.ANALYTICS_MATOMO_TOKEN,
          trackingWebsiteId: process.env.ANALYTICS_WEBSITE_ID,
          dryRun: !!process.env.ANALYTICS_DRY_RUN,
          organizationId: process.env.LOGTO_M2M_ANALYTICS_ORGANIZATION_ID,
        },
      },
      getTokenFn: getM2MTokenFn({
        services: {
          profile: {
            getOrganizationTokenParams: {
              scopes: ["profile:user:read"],
              organizationId,
              ...getBaseProfileConfig(),
            },
          },
          scheduler: {
            getOrganizationTokenParams: {
              logtoOidcEndpoint: process.env.LOGTO_OIDC_ENDPOINT ?? "",
              applicationId: process.env.LOGTO_M2M_SCHEDULER_APP_ID ?? "",
              applicationSecret:
                process.env.LOGTO_M2M_SCHEDULER_APP_SECRET ?? "",
              scopes: ["scheduler:jobs:write"],
              organizationId,
            },
          },
          upload: {
            getOrganizationTokenParams: {
              logtoOidcEndpoint: process.env.LOGTO_OIDC_ENDPOINT ?? "",
              applicationId: process.env.LOGTO_M2M_UPLOADER_APP_ID ?? "",
              applicationSecret:
                process.env.LOGTO_M2M_UPLOADER_APP_SECRET ?? "",
              scopes: ["upload:file:*"],
              organizationId,
            },
          },
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
  return organizationM2MSdk[organizationId];
};

const loadPersonalSdk = (
  userData: { userId: string; accessToken: string },
  logger?: FastifyBaseLogger,
): SetupSdks => {
  return getBuildingBlockSDK({
    services: {
      scheduler: {
        baseUrl: process.env.SCHEDULER_BACKEND_URL ?? "",
      },
      profile: {
        baseUrl: process.env.PROFILE_BACKEND_URL ?? "",
      },
      upload: {
        baseUrl: process.env.UPLOAD_BACKEND_URL ?? "",
      },
      analytics: {
        baseUrl: process.env.ANALYTICS_URL ?? "",
        organizationId: process.env.LOGTO_M2M_ANALYTICS_ORGANIZATION_ID,
        trackingWebsiteId: process.env.ANALYTICS_WEBSITE_ID,
        matomoToken: process.env.ANALYTICS_MATOMO_TOKEN,
        dryRun: !!process.env.ANALYTICS_DRY_RUN,
      },
    },
    getTokenFn: async (serviceName: string): Promise<string> => {
      if (serviceName !== "profile") {
        throw httpErrors.internalServerError(
          `${serviceName} is not available for personal sdks`,
        );
      }

      return userData.accessToken;
    },
    logger,
  });
};

export const ensureUserIdIsSet = (request: {
  userData?: { userId?: string };
}): string => {
  if (request.userData?.userId) {
    return request.userData.userId;
  }

  throw httpErrors.forbidden("User id is not set");
};

export const ensureOrganizationIdIsSet = (request: {
  userData?: { organizationId?: string };
}): string => {
  if (request.userData?.organizationId) {
    return request.userData.organizationId;
  }

  throw httpErrors.forbidden("Organization id is not set");
};

export const getM2MUploadSdk = async (
  logger: FastifyBaseLogger,
  organizationId: string,
): Promise<BuildingBlocksSDK["upload"]> => {
  return loadM2MSdk(organizationId, logger).upload;
};

export const getM2MAnalyticsSdk = async (
  logger: FastifyBaseLogger,
): Promise<BuildingBlocksSDK["analytics"]> => {
  if (analytics) return analytics;

  analytics = loadM2MSdk(
    process.env.LOGTO_M2M_ANALYTICS_ORGANIZATION_ID,
    logger,
  ).analytics;
  return analytics;
};

export const getM2MProfileSdk = async (
  logger: FastifyBaseLogger,
  organizationId?: string,
): Promise<BuildingBlocksSDK["profile"]> => {
  return loadM2MSdk(organizationId, logger).profile;
};

export const getPersonalProfileSdk = async (
  logger: FastifyBaseLogger,
  userData: { userId: string; accessToken: string },
): Promise<BuildingBlocksSDK["profile"]> => {
  return loadPersonalSdk(userData, logger).profile;
};

export const getM2MSchedulerSdk = async (
  logger: FastifyBaseLogger,
  organizationId: string,
): Promise<BuildingBlocksSDK["scheduler"]> => {
  return loadM2MSdk(organizationId, logger).scheduler;
};

export const getFeatureFlagsClient = (ffConfig: {
  url: string;
  token: string;
}): BuildingBlocksSDK["featureFlags"] => {
  if (featureFlags) {
    return featureFlags;
  }

  const fullSdk = getBuildingBlockSDK({
    services: {
      featureFlags: { baseUrl: ffConfig.url },
    },
    getTokenFn: async (serviceName: string) => {
      if (serviceName !== "featureFlags") {
        throw new Error("Wrong method invoked, featureFlags only");
      }
      return ffConfig.token;
    },
  });

  featureFlags = fullSdk.featureFlags;

  return featureFlags;
};
