import type { FastifyBaseLogger } from "fastify";
import type { EnvConfig } from "~/plugins/external/env.js";
import {
  PROFILE_IMPORT_EVENT_ACTIONS,
  PROFILE_IMPORT_EVENT_CATEGORY,
} from "~/services/tracking.js";
import { getOrgAnalyticsSdk } from "~/utils/authentication-factory.js";

export const WebhookAnalyticsService = {
  async trackProfileImportSuccess(params: {
    config: EnvConfig;
    logger: FastifyBaseLogger;
    organizationId: string | undefined;
    email: string;
  }) {
    const { config, logger, organizationId, email } = params;
    const analytics = await getOrgAnalyticsSdk(
      config,
      logger,
      organizationId as string,
    );

    analytics.track.event({
      event: {
        category: PROFILE_IMPORT_EVENT_CATEGORY,
        action: PROFILE_IMPORT_EVENT_ACTIONS.IMPORT_PROFILES_WEBHOOK.action,
        name: `${PROFILE_IMPORT_EVENT_ACTIONS.IMPORT_PROFILES_WEBHOOK.name} (success)`,
        value: 1,
      },
      contextOverride: {
        customDimensions: {
          organizationId: organizationId ?? null,
          email,
        },
      },
    });
  },

  async trackProfileImportError(params: {
    config: EnvConfig;
    logger: FastifyBaseLogger;
    organizationId: string | undefined;
    email: string;
  }) {
    const { config, logger, organizationId, email } = params;
    const analytics = await getOrgAnalyticsSdk(
      config,
      logger,
      organizationId as string,
    );

    analytics.track.event({
      event: {
        category: PROFILE_IMPORT_EVENT_CATEGORY,
        action: PROFILE_IMPORT_EVENT_ACTIONS.IMPORT_PROFILES_WEBHOOK.action,
        name: `${PROFILE_IMPORT_EVENT_ACTIONS.IMPORT_PROFILES_WEBHOOK.name} (error)`,
        value: 0,
      },
      contextOverride: {
        customDimensions: {
          organizationId: organizationId ?? null,
          email,
        },
      },
    });
  },
};
