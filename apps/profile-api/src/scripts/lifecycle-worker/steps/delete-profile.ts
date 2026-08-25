import type { Pool, PoolClient } from "pg";
import type pino from "pino";
import type { DPProxyClient } from "~/clients/dp-proxy.js";
import type { LogtoClient } from "~/clients/logto.js";
import type { LifecycleTask } from "~/schemas/data-lifecycle-tasks/index.js";
import { ProfileStatuses } from "~/schemas/profiles/model.js";
import { getProfile } from "~/services/profiles/get-profile.js";
import {
  type AuditLogResourceType,
  AuditLogResourceTypes,
} from "~/types/audit-logger.js";
import type { AuditLogger } from "~/utils/audit-logger.js";
import { hashPII } from "~/utils/hash-pii.js";
import { type AsyncTask, failed, success } from "../types.js";

/**
 * Enum to track the current step in DeleteProfile task processing.
 * This is stored in metadata to enable resuming from the last successful step on retry.
 */
export const DeleteProfileSteps = {
  CALL_DP_PROXY: "call_dp_proxy",
  DELETE_LOGTO_USER: "delete_logto_user",
  ANONYMIZE_PROFILES: "anonymize_profiles",
  ANONYMIZE_PROFILE_DATA: "anonymize_profile_data",
} as const;

export type DeleteProfileStep =
  (typeof DeleteProfileSteps)[keyof typeof DeleteProfileSteps];

export interface DeleteProfileStepMetadata {
  last_step?: DeleteProfileStep;
  logto_deleted_ids?: string[];
}

interface ExecuteDeleteProfileStepsParams {
  pool: Pool;
  task: LifecycleTask;
  logger: pino.Logger;
  dpProxyClient: DPProxyClient;
  logtoClient: LogtoClient;
  auditLogger: AuditLogger<"user_id" | "client_timestamp" | "metadata">;
}

type BasicProfile = { email: string; id: string; publicName: string };

const stepDependencies: Record<
  DeleteProfileStep,
  Array<DeleteProfileStep | undefined>
> = {
  [DeleteProfileSteps.CALL_DP_PROXY]: [undefined],
  [DeleteProfileSteps.DELETE_LOGTO_USER]: [
    undefined,
    DeleteProfileSteps.CALL_DP_PROXY,
  ],
  [DeleteProfileSteps.ANONYMIZE_PROFILES]: [
    undefined,
    DeleteProfileSteps.CALL_DP_PROXY,
    DeleteProfileSteps.DELETE_LOGTO_USER,
  ],
  [DeleteProfileSteps.ANONYMIZE_PROFILE_DATA]: [
    undefined,
    DeleteProfileSteps.CALL_DP_PROXY,
    DeleteProfileSteps.DELETE_LOGTO_USER,
    DeleteProfileSteps.ANONYMIZE_PROFILES,
  ],
};

/**
 * Execute the delete profile task steps in a single database transaction.
 * Steps include:
 * 1. Fetch profile and linked profile IDs
 * 2. Call DP proxy anonymize webhook
 * 3. Delete user from Logto
 * 4. Anonymize public_name and email in profiles table
 * 5. Anonymize value field in profile_data table
 *
 * On error, metadata is updated with last_step to enable resuming on retry.
 */
export async function executeDeleteProfileSteps(
  params: ExecuteDeleteProfileStepsParams,
): AsyncTask {
  const { pool, task, logger, dpProxyClient, logtoClient } = params;
  const profileId = task.profile_id;
  const metadata = (task.metadata || {}) as DeleteProfileStepMetadata;
  const lastStep = metadata.last_step;
  const logtoDeletedIds: string[] = metadata.logto_deleted_ids || [];

  const shouldRunStep = createShouldRunStepChecker(lastStep);

  logger.info({ profileId, lastStep }, "Starting DeleteProfile task execution");
  let lastCompletedStep: DeleteProfileStep | undefined = lastStep;
  const defaultMetaValues = params.auditLogger.defaultValues.metadata || {};
  const deleteDefaults: {
    action_type: "delete";
    resource_type: AuditLogResourceType;
    parent_log_entry_id: string | undefined;
  } = {
    action_type: "delete",
    resource_type: AuditLogResourceTypes.Profile,
    parent_log_entry_id: undefined,
  };
  try {
    const parentLogEntry = await params.auditLogger.safeSendLogs([
      {
        ...deleteDefaults,
        metadata: {
          ...defaultMetaValues,
          action: "start_delete_profile_task",
        },
      },
    ]);
    deleteDefaults.parent_log_entry_id =
      parentLogEntry?.data && parentLogEntry.data.length > 0
        ? parentLogEntry.data[0].id
        : undefined;

    const { profiles, profileIds, notFound } = await fetchProfilesWithLinked({
      pool,
      profileId,
      logger,
    });

    if (notFound) {
      params.auditLogger.safeSendLogs([
        {
          ...deleteDefaults,
          successful: false,
          failure_reason: "Profile not found",
        },
      ]);
      logger.warn(
        { profileId },
        "Profile not found during DeleteProfile task execution, marking task as failed",
      );

      return failed(new Error(`Profile with id ${profileId} not found`));
    }

    if (shouldRunStep(DeleteProfileSteps.CALL_DP_PROXY)) {
      params.auditLogger.safeSendLogs([
        {
          ...deleteDefaults,
          metadata: {
            ...defaultMetaValues,
            action: "call_dp_proxy",
          },
        },
      ]);
      await callDpProxy({ dpProxyClient, logger, profileIds });
      lastCompletedStep = DeleteProfileSteps.CALL_DP_PROXY;
    }

    if (shouldRunStep(DeleteProfileSteps.DELETE_LOGTO_USER)) {
      params.auditLogger.safeSendLogs([
        {
          ...deleteDefaults,
          metadata: {
            ...defaultMetaValues,
            action: "delete_logto_user",
          },
        },
      ]);

      const deletedIds = await deleteLogtoUsers({
        logtoClient,
        logger,
        profileIds,
        alreadyDeletedIds: logtoDeletedIds,
      });
      logtoDeletedIds.push(...deletedIds);

      lastCompletedStep = DeleteProfileSteps.DELETE_LOGTO_USER;
    }

    await runInTransaction(pool, logger, async (client) => {
      if (shouldRunStep(DeleteProfileSteps.ANONYMIZE_PROFILES)) {
        params.auditLogger.safeSendLogs([
          {
            ...deleteDefaults,
            metadata: {
              ...defaultMetaValues,
              action: "anonymize_profiles",
            },
          },
        ]);
        await anonymizeProfilesTable(client, profiles, logger);
        lastCompletedStep = DeleteProfileSteps.ANONYMIZE_PROFILES;
      }

      if (shouldRunStep(DeleteProfileSteps.ANONYMIZE_PROFILE_DATA)) {
        params.auditLogger.safeSendLogs([
          {
            ...deleteDefaults,
            metadata: {
              ...defaultMetaValues,
              action: "anonymize_profile_data",
            },
          },
        ]);
        await anonymizeProfileData(client, profileIds, logger);
        lastCompletedStep = DeleteProfileSteps.ANONYMIZE_PROFILE_DATA;
      }
    });

    logger.info({ profileId }, "DeleteProfile task completed successfully");
    params.auditLogger.safeSendLogs([
      {
        ...deleteDefaults,
        successful: true,
      },
    ]);
  } catch (error) {
    const updatedMetadata = {
      ...metadata,
      last_step: lastCompletedStep,
      logto_deleted_ids: logtoDeletedIds,
    };

    logger.error(
      { profileId, error, lastStep: lastCompletedStep, updatedMetadata },
      "DeleteProfile task failed",
    );
    await params.auditLogger.sendLogs([
      {
        ...deleteDefaults,
        successful: false,
        failure_reason: error instanceof Error ? error.message : String(error),
        metadata: {
          ...defaultMetaValues,
          last_step: lastCompletedStep,
          logto_deleted_ids: logtoDeletedIds,
        },
      },
    ]);
    throw error;
  }

  return success(undefined);
}

function createShouldRunStepChecker(lastStep?: DeleteProfileStep) {
  return (step: DeleteProfileStep): boolean => {
    return stepDependencies[step].includes(lastStep);
  };
}

async function fetchProfilesWithLinked(params: {
  pool: Pool;
  profileId: string;
  logger: pino.Logger;
}): Promise<
  | { profiles: BasicProfile[]; profileIds: string[]; notFound: undefined }
  | { profileIds: undefined; profiles: undefined; notFound: true }
> {
  const { pool, profileId, logger } = params;
  const client = await pool.connect();
  try {
    logger.debug({ profileId }, "Fetching profile and linked profiles");

    const profile = await getProfile({
      client,
      profileId,
      organizationId: undefined,
      addLinkedProfiles: true,
      consentSubjects: [],
    });

    logger.info({ profileId }, "Profile fetched successfully");

    const profiles: BasicProfile[] = [profile];

    if (
      Array.isArray(profile.linkedProfiles) &&
      profile.linkedProfiles.length
    ) {
      profiles.push(...profile.linkedProfiles);
    }

    const profileIds = profiles.map((p) => p.id);

    logger.debug(
      { profileId, linkedProfileIds: profileIds },
      "Profile and linked profiles fetched",
    );
    return { profiles, profileIds, notFound: undefined };
  } catch (error) {
    logger.error(
      { profileId, error },
      "Failed to fetch profile and linked profiles",
    );
    const httpError =
      typeof error === "object" && error !== null && "status" in error;
    if (httpError && error.status === 404) {
      return { profileIds: undefined, profiles: undefined, notFound: true };
    }
    throw error;
  } finally {
    client.release();
  }
}

async function callDpProxy(params: {
  dpProxyClient: DPProxyClient;
  logger: pino.Logger;
  profileIds: string[];
}): Promise<void> {
  const { dpProxyClient, logger, profileIds } = params;

  logger.info({ profileIds }, "Calling DP proxy to anonymize user");

  await dpProxyClient.anonymizeUser(
    {
      event: "anonymize_user",
      profileIds,
    },
    logger,
  );

  logger.info({ profileIds }, "DP proxy call succeeded");
}

async function deleteLogtoUsers(params: {
  logtoClient: LogtoClient;
  logger: pino.Logger;
  profileIds: string[];
  alreadyDeletedIds: string[];
}): Promise<string[]> {
  const { logtoClient, logger, profileIds, alreadyDeletedIds } = params;

  const toDeleteLogtoIds = profileIds.filter(
    (p) => !alreadyDeletedIds.includes(p),
  );
  const deletionResults = await Promise.all(
    toDeleteLogtoIds.map(async (p) => {
      try {
        await logtoClient.deleteUser(p);
        logger.info({ profileId: p }, "Logto user deleted successfully");
        return { id: p, success: true } as const;
      } catch (error) {
        logger.warn(
          { profileId: p, error },
          "Failed to delete Logto user, continuing with anonymization",
        );
        return { id: p, success: false } as const;
      }
    }),
  );

  return deletionResults
    .filter((result) => result.success)
    .map((result) => result.id);
}

async function runInTransaction(
  pool: Pool,
  logger: pino.Logger,
  work: (client: PoolClient) => Promise<void>,
): Promise<void> {
  const client = await pool.connect();
  await client.query("BEGIN");

  try {
    await work(client);
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      logger.error({ rollbackError }, "Failed to rollback transaction");
    }

    throw error;
  } finally {
    client.release();
  }
}

/**
 * Anonymize public_name and email in the profiles table for specified profiles.
 */
async function anonymizeProfilesTable(
  client: PoolClient,
  profiles: { email: string; id: string; publicName: string }[],
  logger: pino.Logger,
): Promise<void> {
  // Create update statements for each profile
  for (const profile of profiles) {
    const hashedPublicName = hashPII(profile.publicName);
    const hashedEmail = hashPII(profile.email);

    await client.query(
      `
        UPDATE profiles
        SET public_name = $1,
            email = $2,
            updated_at = NOW(),
            status = $3
        WHERE id = $4
      `,
      [hashedPublicName, hashedEmail, ProfileStatuses.Deleted, profile.id],
    );

    logger.debug({ profileId: profile.id }, "Profile record anonymized");
  }
}

/**
 * Anonymize the value field in profile_data table for specified profiles.
 * Only anonymizes rows where the related profile_details has organisation_id IS NULL.
 */
async function anonymizeProfileData(
  client: PoolClient,
  profileIds: string[],
  logger: pino.Logger,
): Promise<void> {
  // Get all profile_data rows to anonymize
  const result = await client.query(
    `
      SELECT pd.id, pd.value
      FROM profile_data pd
      INNER JOIN profile_details pdet ON pd.profile_details_id = pdet.id
      WHERE pdet.profile_id = ANY($1::varchar[])
        AND pdet.organisation_id IS NULL
    `,
    [profileIds],
  );

  const rowsToAnonymize = result.rows as Array<{
    id: string;
    value: string | null;
  }>;

  logger.debug(
    { profileIds, rowCount: rowsToAnonymize.length },
    "Found profile_data rows to anonymize",
  );

  // Anonymize each row
  for (const row of rowsToAnonymize) {
    if (row.value === null || row.value === "") {
      // Skip null or empty values
      continue;
    }

    const hashedValue = hashPII(row.value);

    await client.query(
      `
        UPDATE profile_data
        SET value = $1
        WHERE id = $2
      `,
      [hashedValue, row.id],
    );
  }

  logger.debug(
    { profileIds, anonymizedCount: rowsToAnonymize.length },
    "Profile_data rows anonymized",
  );
}
