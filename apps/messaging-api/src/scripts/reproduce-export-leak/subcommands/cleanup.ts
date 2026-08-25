import type { OrgSdkClients } from "../clients/create-sdk-clients.js";
import { extractSdkErrorDetail } from "../clients/sdk-error.js";
import type { CleanupCommand, LoadedConfig, Logger } from "../domain/types.js";
import { resolveUser } from "../resolve/resolve-user.js";

/**
 * Removes the cross-user file share injected by `seed`. Prefers the SDK method
 * `upload.removeFileSharing`; the underlying call is
 * `DELETE /api/v1/permissions/` with `{ fileId, userId }` on the upload API.
 */
async function removeShare(params: {
  clients: OrgSdkClients;
  fileId: string;
  userId: string;
  logger: Logger;
}): Promise<void> {
  const { clients, fileId, userId, logger } = params;
  logger.warn("[cleanup] Removing leaked file share.", { fileId, userId });

  try {
    await clients.upload.removeFileSharing(fileId, userId);
    logger.info("[cleanup] Leak share removed.", { fileId, userId });
  } catch (error) {
    throw new Error(
      `removeFileSharing(${fileId} -> ${userId}) failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function purgeFile(params: {
  clients: OrgSdkClients;
  fileId: string;
  logger: Logger;
}): Promise<void> {
  const { clients, fileId, logger } = params;
  logger.warn(
    "[cleanup] --purge: scheduling deletion of the seeded file. " +
      "This removes the file for ALL users it was shared with.",
    { fileId },
  );

  const result = await clients.upload.scheduleFileDeletion(fileId);
  if (result.error) {
    throw new Error(
      `scheduleFileDeletion(${fileId}) failed: ${extractSdkErrorDetail(result.error)}`,
    );
  }
  logger.info("[cleanup] Seeded file scheduled for deletion.", { fileId });
}

export async function runCleanup(params: {
  config: LoadedConfig;
  command: CleanupCommand;
  clients: OrgSdkClients;
  logger: Logger;
}): Promise<void> {
  const { config, command, clients, logger } = params;

  // Prefer explicit flags (from the seed summary). If userId is omitted, fall
  // back to the resolved user1 profile id; fileId cannot be re-derived and must
  // be supplied.
  let userId = command.userId;
  if (userId == null) {
    logger.info(
      "[cleanup] --user-id not supplied; falling back to resolved user1.",
    );
    const user1 = await resolveUser({
      profile: clients.profile,
      identifier: config.user1,
    });
    userId = user1.profileId;
  }

  const fileId = command.fileId;
  if (fileId == null) {
    throw new Error(
      "cleanup requires --file-id (the leaked file id printed by `seed`). " +
        "Re-run seed if you did not record it.",
    );
  }

  await removeShare({ clients, fileId, userId, logger });

  if (command.purge) {
    await purgeFile({ clients, fileId, logger });
  } else {
    logger.info(
      "[cleanup] Done. Seeded messages are NOT deleted automatically; " +
        "remove them manually via the messaging admin tools if required. " +
        "Pass --purge to also schedule deletion of the seeded file (--file-id).",
    );
  }
}
