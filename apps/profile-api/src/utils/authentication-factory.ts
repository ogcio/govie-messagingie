import { httpErrors } from "@fastify/sensible";
import {
  type BuildingBlocksSDK,
  type DefinedServices,
  getBuildingBlockSDK,
  getM2MTokenFn,
  type TokenFunction,
} from "@ogcio/building-blocks-sdk";
import type { FastifyBaseLogger } from "fastify";
import type { EnvConfig, M2MSdksConfig } from "~/plugins/external/env.js";
import { withTrailingSlash } from "./with-trailing-slash.js";

type OrgSdks = DefinedServices<{
  services: {
    scheduler: {
      baseUrl: string;
    };
    analytics?: {
      baseUrl: string;
    };
  };
  getTokenFn: TokenFunction;
}>;

type CitizenSdks = DefinedServices<{
  services: {
    upload: {
      baseUrl: string;
    };
  };
  getTokenFn: TokenFunction;
}>;

type M2MSdks = DefinedServices<{
  services: {
    auditCollector: {
      baseUrl: string;
    };
  };
  getTokenFn: TokenFunction;
}>;

const sdkPerOrganisation: { [organizationId: string]: OrgSdks } = {};
let m2mSdk: M2MSdks | null = null;
let lifecycleWorkerM2MSdk: {
  upload: BuildingBlocksSDK["upload"];
  messaging: BuildingBlocksSDK["messaging"];
} | null = null;

let featureFlags: BuildingBlocksSDK["featureFlags"] | undefined;

export const getOrgSchedulerSdk = async (
  logger: FastifyBaseLogger,
  organizationId: string,
  config: EnvConfig,
): Promise<BuildingBlocksSDK["scheduler"]> => {
  return loadOrgBuildingBlocksSdk(config, organizationId, logger).scheduler;
};

export const getOrgAnalyticsSdk = async (
  config: EnvConfig,
  logger: FastifyBaseLogger,
  organizationId: string,
): Promise<BuildingBlocksSDK["analytics"]> => {
  return loadOrgBuildingBlocksSdk(config, organizationId, logger).analytics;
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

const loadOrgBuildingBlocksSdk = (
  config: EnvConfig,
  organizationId?: string,
  logger?: FastifyBaseLogger,
): OrgSdks => {
  if (!organizationId) {
    throw httpErrors.internalServerError("No sdk for citizen are available");
  }

  if (!sdkPerOrganisation[organizationId]) {
    sdkPerOrganisation[organizationId] = getBuildingBlockSDK({
      services: {
        scheduler: {
          baseUrl: config.SCHEDULER_BACKEND_URL,
        },
        analytics: {
          baseUrl: config.ANALYTICS_URL ?? "",
          matomoToken: config.ANALYTICS_MATOMO_TOKEN,
          trackingWebsiteId: config.ANALYTICS_WEBSITE_ID,
          dryRun: config.ANALYTICS_DRY_RUN,
          organizationId:
            config.LOGTO_M2M_ANALYTICS_ORGANIZATION_ID ?? organizationId,
        },
      },
      getTokenFn: getM2MTokenFn({
        services: {
          scheduler: {
            getOrganizationTokenParams: {
              logtoOidcEndpoint: config.LOGTO_OIDC_ENDPOINT,
              applicationId: config.LOGTO_M2M_SCHEDULER_APP_ID,
              applicationSecret: config.LOGTO_M2M_SCHEDULER_APP_SECRET,
              scopes: ["scheduler:jobs:write"],
              organizationId,
            },
          },
          analytics: {
            getOrganizationTokenParams: {
              applicationId: config.LOGTO_M2M_ANALYTICS_APP_ID ?? "",
              applicationSecret: config.LOGTO_M2M_ANALYTICS_APP_SECRET ?? "",
              logtoOidcEndpoint: config.LOGTO_OIDC_ENDPOINT,
              organizationId:
                config.LOGTO_M2M_ANALYTICS_ORGANIZATION_ID ?? organizationId,
              scopes: config.LOGTO_M2M_ANALYTICS_SCOPES
                ? config.LOGTO_M2M_ANALYTICS_SCOPES.split(",")
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

const loadM2MSdk = (
  config: M2MSdksConfig,
  logger?: FastifyBaseLogger,
): M2MSdks => {
  if (m2mSdk) {
    return m2mSdk;
  }

  m2mSdk = getBuildingBlockSDK({
    services: {
      auditCollector: {
        baseUrl: config.AUDIT_COLLECTOR_URL,
      },
      // unused, but configuration needs it
      analytics: {
        baseUrl: "",
        matomoToken: "",
        trackingWebsiteId: "",
        dryRun: true,
        organizationId: "",
      },
    },
    getTokenFn: getM2MTokenFn({
      services: {
        auditCollector: {
          getAccessTokenParams: {
            logtoOidcEndpoint: config.LOGTO_OIDC_ENDPOINT,
            // Audit collector does not need specific scopes
            // so we can just re-use the scheduler app credentials
            applicationId: config.LOGTO_M2M_SCHEDULER_APP_ID,
            applicationSecret: config.LOGTO_M2M_SCHEDULER_APP_SECRET,
            scopes: [],
            resource: withTrailingSlash(config.AUDIT_COLLECTOR_URL),
          },
        },
      },
    }),
    logger,
  });

  return m2mSdk;
};

const loadLifecycleWorkerM2MSdk = (
  config: M2MSdksConfig,
  logger?: FastifyBaseLogger,
): {
  upload: BuildingBlocksSDK["upload"];
  messaging: BuildingBlocksSDK["messaging"];
} => {
  if (lifecycleWorkerM2MSdk) {
    return lifecycleWorkerM2MSdk;
  }

  lifecycleWorkerM2MSdk = getBuildingBlockSDK({
    services: {
      upload: {
        baseUrl: config.UPLOAD_BACKEND_URL,
      },
      messaging: {
        baseUrl: config.MESSAGING_BACKEND_URL,
      },
      // unused, but configuration needs it
      analytics: {
        baseUrl: "",
        matomoToken: "",
        trackingWebsiteId: "",
        dryRun: true,
        organizationId: "",
      },
    },
    getTokenFn: getM2MTokenFn({
      services: {
        upload: {
          getAccessTokenParams: {
            logtoOidcEndpoint: config.LOGTO_OIDC_ENDPOINT,
            applicationId: config.LOGTO_M2M_LIFECYCLE_APP_ID,
            applicationSecret: config.LOGTO_M2M_LIFECYCLE_APP_SECRET,
            scopes: ["platform:upload:read", "platform:upload:write"],
            resource: withTrailingSlash(config.UPLOAD_BACKEND_URL),
          },
        },
        messaging: {
          getAccessTokenParams: {
            logtoOidcEndpoint: config.LOGTO_OIDC_ENDPOINT,
            applicationId: config.LOGTO_M2M_LIFECYCLE_APP_ID,
            applicationSecret: config.LOGTO_M2M_LIFECYCLE_APP_SECRET,
            scopes: ["platform:messaging:read", "platform:messaging:write"],
            resource: withTrailingSlash(config.MESSAGING_BACKEND_URL),
          },
        },
      },
    }),
    logger,
  });

  return lifecycleWorkerM2MSdk;
};

export const getAuditCollectorSdk = (
  config: M2MSdksConfig,
  logger?: FastifyBaseLogger,
): BuildingBlocksSDK["auditCollector"] => {
  const m2mSdks = loadM2MSdk(config, logger);

  return m2mSdks.auditCollector;
};

export const getLifecycleWorkerM2MSdk = (
  config: M2MSdksConfig,
  logger?: FastifyBaseLogger,
): {
  upload: BuildingBlocksSDK["upload"];
  messaging: BuildingBlocksSDK["messaging"];
} => {
  const uploadM2MSdks = loadLifecycleWorkerM2MSdk(config, logger);

  return uploadM2MSdks;
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

export const isOrganizationIdSet = (request: {
  userData?: { organizationId?: string };
}): boolean => {
  if (request.userData?.organizationId) {
    return true;
  }

  return false;
};

export const getCitizenUploadSdk = (params: {
  userData: { userId: string; accessToken: string };
}) => {
  return loadPersonalSdk(params.userData).upload;
};

const loadPersonalSdk = (
  userData: { userId: string; accessToken: string },
  logger?: FastifyBaseLogger,
): CitizenSdks => {
  return getBuildingBlockSDK({
    services: {
      upload: {
        baseUrl: process.env.UPLOAD_BACKEND_URL ?? "",
      },
    },
    getTokenFn: async (serviceName: string): Promise<string> => {
      if (serviceName !== "upload") {
        throw httpErrors.internalServerError(
          `${serviceName} is not available for personal sdks`,
        );
      }

      return userData.accessToken;
    },
    logger,
  });
};
