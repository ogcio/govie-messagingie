import { httpErrors } from "@fastify/sensible";
import type { FastifyBaseLogger } from "fastify";
import type { PoolClient } from "pg";
import { ImportStatuses } from "~/const/profile.js";
import type { EnvConfig } from "~/plugins/external/env.js";
import type { ConsentStatementWithTranslations } from "~/schemas/consent-statements/shared.js";
import { checkIfProfileExists } from "~/services/profiles/sql/check-if-profile-exists-by-id.js";
import { checkProfileImportCompletion } from "~/services/profiles/sql/check-profile-import-completion.js";
import { findProfileImportDetailByEmail } from "~/services/profiles/sql/find-profile-import-detail-by-email.js";
import { getProfileImportDetailDataByEmail } from "~/services/profiles/sql/get-profile-import-detail-data-by-email.js";
import { updateProfileImportDetailsStatus } from "~/services/profiles/sql/update-profile-import-details-status.js";
import { updateProfileImportStatus } from "~/services/profiles/sql/update-profile-import-status.js";
import { withRollback } from "~/utils/with-rollback.js";
import { WebhookAnalyticsService } from "./analytics-service.js";
import { WebhookConsentService } from "./consent-service.js";
import { WebhookProfileService } from "./profile-service.js";
import type { WebhookUser } from "./webhook-body-to-user.js";

export const WebhookProfileImportService = {
  async processProfileImport(params: {
    user: WebhookUser;
    client: PoolClient;
    logger: FastifyBaseLogger;
    config: EnvConfig;
    insertPrivateDetails: boolean;
    onlyPrivateDetails: boolean;
    currentConsentStatement: ConsentStatementWithTranslations | null;
  }) {
    const {
      user,
      client,
      logger,
      config,
      insertPrivateDetails,
      onlyPrivateDetails,
      currentConsentStatement,
    } = params;
    const { profileImportId, email, organizationId } = user;

    if (!profileImportId) {
      throw httpErrors.notFound(
        `${profileImportId} [Webhook] | Error: no profile import found`,
      );
    }

    const importDetail = await getProfileImportDetailDataByEmail(
      client,
      profileImportId,
      email,
    );
    const importDetailsId = await findProfileImportDetailByEmail(
      client,
      profileImportId,
      email,
    );

    // First transaction: Create profile and update status
    const { profileId } = await withRollback(client, async () => {
      if (!organizationId) {
        throw httpErrors.badRequest(
          `${profileImportId} [Webhook] | Error: organization ID is required`,
        );
      }

      const didAlreadyExist = await checkIfProfileExists(client, user.id);

      logger.info(
        `${profileImportId} [Webhook] | Processing profile for user ${user.id}, didAlreadyExist: ${didAlreadyExist}`,
      );

      const profileId = await WebhookProfileService.createProfileFromImportData(
        client,
        user,
        importDetail,
        organizationId,
        insertPrivateDetails,
        onlyPrivateDetails,
      );

      await WebhookConsentService.submitConsentForImport({
        client,
        userId: user.id,
        didAlreadyExist,
        logger,
        currentConsentStatement,
      });

      return { profileId };
    });

    await this.updateImportStatus(
      client,
      importDetailsId,
      logger,
      profileImportId,
    );

    await WebhookAnalyticsService.trackProfileImportSuccess({
      config,
      logger,
      organizationId: organizationId ?? undefined,
      email,
    });

    return { profileId, status: "success" as const };
  },

  async handleImportError(params: {
    user: WebhookUser;
    client: PoolClient;
    logger: FastifyBaseLogger;
    config: EnvConfig;
    error: unknown;
  }) {
    const { user, client, logger, config, error } = params;
    const { profileImportId, email, organizationId } = user;

    logger.error(`${profileImportId} [Webhook] | Error: ${error}`);

    if (profileImportId) {
      const importDetailsId = await findProfileImportDetailByEmail(
        client,
        profileImportId,
        email,
      );

      await updateProfileImportDetailsStatus(
        client,
        [importDetailsId],
        ImportStatuses.FAILED,
      );

      logger.info(
        `${profileImportId} [Webhook] | ${importDetailsId} | ${ImportStatuses.FAILED.toUpperCase()}`,
      );

      await this.updateImportStatus(
        client,
        importDetailsId,
        logger,
        profileImportId,
      );
    }

    await WebhookAnalyticsService.trackProfileImportError({
      config,
      logger,
      organizationId: organizationId ?? undefined,
      email,
    });

    return {
      id: undefined,
      error:
        error instanceof Error
          ? error.message
          : `${profileImportId}: Unknown error occurred`,
      status: "error" as const,
    };
  },

  async updateImportStatus(
    client: PoolClient,
    importDetailsId: string,
    logger: FastifyBaseLogger,
    profileImportId: string,
  ) {
    const updatedImportDetails = await updateProfileImportDetailsStatus(
      client,
      [importDetailsId],
      ImportStatuses.COMPLETED,
    );

    logger.info(
      `${profileImportId} [Webhook] | ${importDetailsId} | ${updatedImportDetails[0].status.toUpperCase()}`,
    );

    // Check completion and update overall status
    logger.info(`${profileImportId} [Webhook] | Checking import completion`);
    const { isComplete, finalStatus } = await checkProfileImportCompletion(
      client,
      profileImportId,
    );

    if (isComplete) {
      await updateProfileImportStatus(client, profileImportId, finalStatus);
      logger.info(
        `${profileImportId} [Webhook] | ${finalStatus.toUpperCase()}`,
      );
    } else {
      logger.info(
        `${profileImportId} [Webhook] | Import not complete yet, staying in processing state`,
      );
    }
  },
};
