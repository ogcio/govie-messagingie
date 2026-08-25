import type { FastifyBaseLogger } from "fastify";
import type { Pool } from "pg";
import type { LogtoClient } from "~/clients/logto.js";
import type { EnvConfig } from "~/plugins/external/env.js";
import type { ConsentStatementWithTranslations } from "~/schemas/consent-statements/shared.js";
import { ConsentSubjects } from "~/schemas/consents/shared.js";
import { getCurrentConsentStatement } from "~/services/consent-statements/consent-statements-service.js";
import { withClient } from "~/utils/with-client.js";
import { WebhookConsentService } from "./consent-service.js";
import { WebhookProfileImportService } from "./profile-import-service.js";
import { WebhookProfileService } from "./profile-service.js";
import type { WebhookProcessingParams, WebhookResponse } from "./types.js";
import { type WebhookUser, webhookBodyToUser } from "./webhook-body-to-user.js";

export const processUserCreatedOrUpdatedWebhook = async (
  params: WebhookProcessingParams,
): Promise<WebhookResponse> => {
  // List of application IDs for which OTP is enabled
  const otpApplicationIds = params.config.OTP_APPLICATION_IDS
    ? params.config.OTP_APPLICATION_IDS.split(",").map((id) => id.trim())
    : [];
  const applicationId =
    params.body.application?.id ?? params.body.applicationId ?? undefined;
  const body = { ...params.body.data, applicationId };
  const user = webhookBodyToUser(body, otpApplicationIds);

  const currentConsentStatement = await getCurrentConsentStatement({
    pool: params.pool,
    subject: ConsentSubjects.Messaging,
  });

  if (user.profileImportId) {
    return processUserForProfileImport({
      user,
      ...params,
      insertPrivateDetails:
        params.body.data.customData.insertPrivateDetails ?? false,
      onlyPrivateDetails:
        params.body.data.customData.onlyPrivateDetails ?? false,
      currentConsentStatement,
    });
  }

  return processUserForDirectSignin({
    user,
    ...params,
    currentConsentStatement,
  });
};

async function processUserForProfileImport(params: {
  user: WebhookUser;
  pool: Pool;
  logger: FastifyBaseLogger;
  config: EnvConfig;
  insertPrivateDetails: boolean;
  onlyPrivateDetails: boolean;
  currentConsentStatement: ConsentStatementWithTranslations | null;
}): Promise<WebhookResponse> {
  const { user, pool, logger, config } = params;

  return withClient(pool, async (client) => {
    try {
      const result = await WebhookProfileImportService.processProfileImport({
        user,
        client,
        logger,
        config,
        insertPrivateDetails: params.insertPrivateDetails,
        onlyPrivateDetails: params.onlyPrivateDetails,
        currentConsentStatement: params.currentConsentStatement,
      });

      return { id: result.profileId, status: result.status };
    } catch (error) {
      return WebhookProfileImportService.handleImportError({
        user,
        client,
        logger,
        config,
        error,
      });
    }
  });
}

async function processUserForDirectSignin(params: {
  user: WebhookUser;
  pool: Pool;
  logger: FastifyBaseLogger;
  currentConsentStatement: ConsentStatementWithTranslations | null;
  getLogtoClient: () => Promise<LogtoClient>;
}): Promise<WebhookResponse> {
  const { user, pool, logger } = params;

  return withClient(pool, async (client) => {
    try {
      // Handle account linking if PPSN is provided
      if (user.details?.ppsn) {
        logger.info(`Looking for interim user with PPSN: ${user.details.ppsn}`);

        const interimUser = await WebhookProfileService.findInterimUserByPpsn(
          client,
          user.details.ppsn,
        );

        logger.info(
          `Interim user search result: ${interimUser ? `Found user ${interimUser.id}` : "Not found"}`,
        );

        if (interimUser) {
          logger.info(
            `Found interim user ${interimUser.id} with matching PPSN ${user.details.ppsn}`,
          );

          // Link the interim user to the logged-in user first
          await WebhookProfileService.linkInterimUser(
            client,
            interimUser.id,
            user.id,
          );

          logger.info(
            `Linked interim user ${interimUser.id} to logged in user ${user.id}`,
          );

          // Create or update profile for the logged-in user
          const profileId =
            await WebhookProfileService.createOrUpdateProfileForDirectSignin(
              client,
              user,
              pool,
              params.getLogtoClient,
              logger,
            );

          logger.info(
            `About to call cascadeConsentOnAccountLinking with primaryUserId: ${user.id}, linkedProfileId: ${interimUser.id}, hasConsentStatement: ${!!params.currentConsentStatement}`,
          );

          // Cascade consent preferences after profiles are created
          let consentCascadeFailed = false;
          try {
            await WebhookConsentService.cascadeConsentOnAccountLinking({
              client,
              primaryUserId: user.id,
              linkedProfileId: interimUser.id,
              logger,
              currentConsentStatement: params.currentConsentStatement,
            });

            logger.info(
              `cascadeConsentOnAccountLinking completed for primaryUserId: ${user.id}, linkedProfileId: ${interimUser.id}`,
            );
          } catch (consentError) {
            consentCascadeFailed = true;
            logger.error(
              { error: consentError },
              `Error during consent cascade for primaryUserId: ${user.id}, linkedProfileId: ${interimUser.id}`,
            );
            // Continue processing even if consent cascade fails
          }

          // Skip regular consent submission since we've already cascaded consent
          // But add fallback consent if cascade failed
          if (consentCascadeFailed) {
            logger.info(
              `Submitting fallback consent for user ${user.id} due to cascade failure`,
            );
            await WebhookConsentService.submitConsentForDirectSignin({
              userId: user.id,
              consentStatementId: params.currentConsentStatement?.id ?? null,
              client,
              logger,
              consentStatus: user.consentStatusOnDirectSignin,
            });
          } else {
            logger.info(
              `Skipping regular consent submission for user ${user.id} since consent was already cascaded`,
            );
          }
          return { id: profileId, status: "success" };
        }

        logger.info(`No interim user found with PPSN: ${user.details.ppsn}`);
      }

      // Create or update profile for users without interim user linking
      const profileId =
        await WebhookProfileService.createOrUpdateProfileForDirectSignin(
          client,
          user,
          pool,
          params.getLogtoClient,
          logger,
        );

      // Submit consent
      await WebhookConsentService.submitConsentForDirectSignin({
        userId: user.id,
        consentStatementId: params.currentConsentStatement?.id ?? null,
        client,
        logger,
        consentStatus: user.consentStatusOnDirectSignin,
      });

      return { id: profileId, status: "success" };
    } catch (error) {
      logger.error(
        { error },
        "[Webhook] Error processing webhook for direct signin:",
      );
      return {
        id: undefined,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        status: "error",
      };
    }
  });
}
