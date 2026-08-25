import type { FastifyBaseLogger } from "fastify";
import type { PoolClient } from "pg";
import type { ConsentStatementWithTranslations } from "~/schemas/consent-statements/shared.js";
import {
  CascadeConsentReasons,
  type ConsentStatus,
  ConsentStatuses,
  type ConsentSubject,
  ConsentSubjects,
} from "~/schemas/consents/shared.js";
import type {
  LinkedProfile,
  ProfileWithLinkedProfiles,
} from "~/schemas/profiles/model.js";
import {
  getLatestConsentForUser,
  propagateConsentOnAccountLinking,
  submitConsent,
} from "~/services/consents/consents-service.js";
import { getProfile } from "~/services/profiles/get-profile.js";
import type { AccountLinkingParams } from "./types.js";

const CONSENT_SUBJECT = ConsentSubjects.Messaging;

export const WebhookConsentService = {
  async isLatestConsentUndefined(params: {
    client: PoolClient;
    subject: ConsentSubject;
    userId: string;
  }): Promise<boolean> {
    try {
      const consent = await getLatestConsentForUser(params);
      return consent.status === ConsentStatuses.Undefined;
    } catch (e) {
      if (typeof e === "object" && e?.constructor.name === "NotFoundError") {
        return true;
      }
      throw e;
    }
  },

  async hasPreviousConsent(params: {
    client: PoolClient;
    subject: ConsentSubject;
    userId: string;
  }): Promise<
    | { hasPreviousConsent: true; status: ConsentStatus }
    | { hasPreviousConsent: false }
  > {
    try {
      const consent = await getLatestConsentForUser(params);
      return { hasPreviousConsent: true, status: consent.status };
    } catch (e) {
      if (typeof e === "object" && e?.constructor.name === "NotFoundError") {
        return { hasPreviousConsent: false };
      }
      throw e;
    }
  },

  /**
   * Submits consent for user profiles during the import process.
   *
   * This function handles consent submission when profiles are being imported into the system.
   * It includes logic to handle both new profiles and existing profiles differently:
   *
   * 1. **New Profiles**: Directly submits pre-approved consent for new users
   * 2. **Existing Profiles**: Only submits consent for primary profiles (not linked profiles)
   *    that have undefined consent status, ensuring consent inheritance is handled properly
   *
   * @param params - Configuration object containing client, user info, and consent settings
   * @param params.client - Database client for transactions
   * @param params.userId - The user ID to submit consent for
   * @param params.didAlreadyExist - Whether the profile already existed before import
   * @param params.logger - Logger instance for debugging and monitoring
   * @param params.currentConsentStatement - Current consent statement to use for submission
   */
  async submitConsentForImport(params: {
    client: PoolClient;
    userId: string;
    didAlreadyExist: boolean;
    logger: FastifyBaseLogger;
    currentConsentStatement: ConsentStatementWithTranslations | null;
  }): Promise<void> {
    const { client, userId, didAlreadyExist, logger, currentConsentStatement } =
      params;

    if (!currentConsentStatement) {
      return;
    }

    const basicParams = {
      consentInput: {
        subject: CONSENT_SUBJECT,
        status: ConsentStatuses.PreApproved,
        consentStatementId: currentConsentStatement.id,
      },
      userId,
      client,
      logger,
    };

    if (!didAlreadyExist) {
      await submitConsent({
        ...basicParams,
        userId,
        reason: CascadeConsentReasons.FirstImport,
      });
      return;
    }

    const profile = await getProfile({
      organizationId: undefined,
      profileId: userId,
      client,
      addLinkedProfiles: true,
      consentSubjects: [],
    });

    if (profile.primaryUserId !== profile.id) {
      logger.info(
        `Profile ${userId} is a linked profile (primaryUserId: ${profile.primaryUserId}), skipping consent submission for import as consent should be handled by the primary profile`,
      );
      return; // do not submit if it's a child
    }

    const isLatestUndefined =
      await WebhookConsentService.isLatestConsentUndefined({
        client,
        userId,
        subject: CONSENT_SUBJECT,
      });

    if (!isLatestUndefined) {
      return; // do not submit if it has no undefined status
    }

    const toSendProfile = (
      profile.linkedProfiles ? profile : { ...profile, linkedProfiles: [] }
    ) as Omit<ProfileWithLinkedProfiles, "linkedProfiles"> & {
      linkedProfiles: LinkedProfile[];
    };

    await submitConsent({
      ...basicParams,
      profile: toSendProfile,
      reason: CascadeConsentReasons.FirstImport,
    });
  },

  /**
   * Submits consent for users during direct sign-in processes.
   *
   * This function handles consent submission when users sign in directly to the system.
   * It implements a "first-time user" pattern where consent is only submitted if:
   *
   * 1. **No Previous Consent**: The user has never submitted consent for this subject before
   * 2. **Valid Consent Statement**: A valid consent statement ID is provided
   *
   * When conditions are met, it submits an "undefined" consent status, indicating that
   * the user needs to make an explicit consent decision during their session.
   *
   * @param params - Configuration object containing user info and consent settings
   * @param params.userId - The user ID to submit consent for
   * @param params.consentStatementId - ID of the consent statement to use (can be null)
   * @param params.client - Database client for transactions
   * @param params.logger - Logger instance for debugging and monitoring
   */
  async submitConsentForDirectSignin(params: {
    userId: string;
    consentStatementId: string | null;
    client: PoolClient;
    logger: FastifyBaseLogger;
    consentStatus: ConsentStatus;
  }): Promise<void> {
    const { userId, consentStatementId, client, logger } = params;

    if (!consentStatementId) {
      return;
    }

    const previousConsentResult =
      await WebhookConsentService.hasPreviousConsent({
        client,
        userId,
        subject: CONSENT_SUBJECT,
      });
    const needToSubmitConsent =
      !previousConsentResult.hasPreviousConsent ||
      (previousConsentResult.status === ConsentStatuses.Undefined &&
        params.consentStatus !== ConsentStatuses.Undefined);

    if (!needToSubmitConsent) {
      return;
    }

    await submitConsent({
      consentInput: {
        subject: CONSENT_SUBJECT,
        status: params.consentStatus,
        consentStatementId: consentStatementId,
      },
      userId,
      client,
      logger,
      reason: CascadeConsentReasons.FirstLogin,
    });
  },

  /**
   * Cascades consent from primary profiles to linked profiles during account linking.
   *
   * This function handles the complex scenario where two user accounts are being linked
   * and ensures that consent is properly inherited between the profiles. Key features:
   *
   * 1. **Idempotency**: Prevents duplicate cascade processing by checking for existing
   *    cascade relationships in the database
   * 2. **Profile Validation**: Ensures both primary and linked profiles exist and are
   *    in valid states for consent cascading
   * 3. **Consent Status Management**: Only cascades consent when profiles have undefined
   *    consent status, avoiding overwriting existing consent decisions
   * 4. **Audit Trail**: Maintains cascade tracking with source profile information
   *    for linked profiles while primary profiles don't have cascade tracking
   *
   * The function handles various edge cases including:
   * - Profiles that don't exist yet (skips processing)
   * - Invalid profile relationships (skips processing)
   * - Database errors (logs and continues for non-critical errors)
   *
   * @param params - Configuration object containing account linking parameters
   * @param params.client - Database client for transactions
   * @param params.primaryUserId - ID of the primary user profile
   * @param params.linkedProfileId - ID of the profile being linked
   * @param params.logger - Logger instance for debugging and monitoring
   * @param params.currentConsentStatement - Current consent statement to use
   */
  async cascadeConsentOnAccountLinking(
    params: AccountLinkingParams,
  ): Promise<void> {
    const {
      client,
      primaryUserId,
      linkedProfileId,
      logger,
      currentConsentStatement,
    } = params;

    logger.info(
      `cascadeConsentOnAccountLinking called with primaryUserId: ${primaryUserId}, linkedProfileId: ${linkedProfileId}, hasConsentStatement: ${!!currentConsentStatement}`,
    );

    if (!currentConsentStatement) {
      logger.info(
        `cascadeConsentOnAccountLinking returning early - hasConsentStatement: ${!!currentConsentStatement}`,
      );
      return;
    }

    await propagateConsentOnAccountLinking({
      client,
      primaryProfileId: primaryUserId,
      childProfileId: linkedProfileId,
      logger,
      currentConsentStatement,
      reason: CascadeConsentReasons.AccountLinking,
    });
  },
};
