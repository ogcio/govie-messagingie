import {
  type BlacklistEnvironments,
  DEFAULT_BLACKLIST_ENVIRONMENT,
  getBlacklist,
} from "blacklist-profiles";
import type { Pool } from "pg";
import pino from "pino";
import {
  CascadeConsentReasons,
  type Consent,
  ConsentStatuses,
  ConsentSubjects,
} from "~/schemas/consents/shared.js";
import { getCurrentConsentStatement } from "~/services/consent-statements/consent-statements-service.js";
import {
  getLatestConsentForUser,
  submitConsent,
} from "~/services/consents/consents-service.js";

export async function blacklistProfiles(pool: Pool): Promise<void> {
  const logger = pino.pino();
  const client = await pool.connect();
  const environment = (process.env.BLACKLIST_ENVIRONMENT ??
    DEFAULT_BLACKLIST_ENVIRONMENT) as BlacklistEnvironments;
  const blacklist = getBlacklist({ environment });
  try {
    const { id: consentStatementId } = await getCurrentConsentStatement({
      pool,
      subject: ConsentSubjects.Messaging,
    });

    logger.info({ message: `Blacklisting ${blacklist.length} profiles` });

    for (const profile of blacklist) {
      const partialProfile = `${profile.substring(0, 3)}...${profile.substring(profile.length - 3)}`;
      try {
        const latestConsent = await maybeGetLatestConsent({
          pool,
          userId: profile,
        });
        if (
          latestConsent &&
          (latestConsent.status === ConsentStatuses.OptedOut ||
            latestConsent.status === ConsentStatuses.OptedIn)
        ) {
          logger.info({
            message: "Profile has already made a consent choice",
            profile: partialProfile,
          });
          continue;
        }
        logger.info({
          message: "Blacklisting profile",
          profile: partialProfile,
        });
        await submitConsent({
          pool,
          logger: pino.pino(),
          userId: profile,
          consentInput: {
            subject: ConsentSubjects.Messaging,
            status: ConsentStatuses.OptedOut,
            consentStatementId,
          },
          reason: CascadeConsentReasons.ManualAdminAction,
        });
        logger.info({
          message: "Profile blacklisted",
          profile: partialProfile,
        });
      } catch (error) {
        logger.error({
          message: "Error blacklisting profile",
          profile: partialProfile,
          error,
        });
      }
    }
  } finally {
    client.release();
    logger.info({ message: "Client released" });
  }
}

async function maybeGetLatestConsent(params: {
  userId: string;
  pool: Pool;
}): Promise<Consent | null> {
  try {
    return await getLatestConsentForUser({
      ...params,
      subject: ConsentSubjects.Messaging,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("User has not consents")
    ) {
      return null;
    }
    throw error;
  }
}
