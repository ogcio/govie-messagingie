import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ZipArchive } from "archiver";
import type { Pool } from "pg";
import type pino from "pino";
import type { M2MSdksConfig } from "~/plugins/external/env.js";
import { getProfile } from "~/services/profiles/get-profile.js";
import {
  type AuditLogResourceType,
  AuditLogResourceTypes,
} from "~/types/audit-logger.js";
import type { AuditLogger } from "~/utils/audit-logger.js";
import { getLifecycleWorkerM2MSdk } from "~/utils/authentication-factory.js";
import { type AsyncTask, failed, success } from "../../types.js";
import { downloadAndZipFiles } from "./files.js";
import {
  getAttachmentFileIdsByUserId,
  getMessagesForUsers,
} from "./messages.js";
import { notifyExportReady } from "./notify.js";
import { getProfileIdsToExport, loadProfilesById } from "./profiles.js";
import { uploadExportArchive } from "./upload.js";
import { cleanupZipFile, logZipSize } from "./utils.js";
import { appendStructuredDataToZip } from "./zip.js";

const UPLOAD_EXPIRY_DAYS = 30;

export async function exportUserDataSdk(params: {
  profileId: string;
  auditLogger: AuditLogger<"user_id" | "metadata" | "client_timestamp">;
  logger: pino.Logger;
  m2mConfig: M2MSdksConfig;
  pool: Pool;
  notifyUser: boolean;
}): AsyncTask {
  const { profileId, logger, auditLogger, m2mConfig, pool, notifyUser } =
    params;
  const defaultMetaValues = auditLogger.defaultValues.metadata || {};
  const exportDefaults: {
    action_type: "read";
    resource_type: AuditLogResourceType;
    parent_log_entry_id: string | undefined;
  } = {
    action_type: "read",
    resource_type: AuditLogResourceTypes.ExportUserData,
    parent_log_entry_id: undefined,
  };

  const auditLogParent = await auditLogger.safeSendLogs([
    {
      ...exportDefaults,
      metadata: {
        ...defaultMetaValues,
        action: "start_export_user_data_task",
      },
    },
  ]);

  exportDefaults.parent_log_entry_id =
    auditLogParent?.data && auditLogParent.data.length > 0
      ? auditLogParent.data[0].id
      : undefined;

  logger.info("[Export Data] Audit log trail initialized");

  const profile = await getProfile({
    profileId,
    pool,
    organizationId: undefined,
    addLinkedProfiles: true,
    consentSubjects: [],
  });

  logger.info(
    { linkedProfileCount: profile.linkedProfiles?.length },
    `[Export Data SDK] Found ${profile.linkedProfiles?.length} linked profiles for user ${profileId}`,
  );

  const profileIdsToExport = getProfileIdsToExport({
    profileId,
    linkedProfiles: profile.linkedProfiles,
  });

  const profileDataById = await loadProfilesById({
    profileIds: profileIdsToExport,
    pool,
  });

  auditLogger.safeSendLogs([
    {
      ...exportDefaults,
      metadata: {
        ...defaultMetaValues,
        action: "loaded_profiles",
        profile_ids: profileIdsToExport,
      },
    },
  ]);

  const workerM2MSdks = getLifecycleWorkerM2MSdk(m2mConfig, logger);

  auditLogger.safeSendLogs([
    {
      ...exportDefaults,
      metadata: {
        ...defaultMetaValues,
        action: "loading_messages",
        profile_ids: profileIdsToExport,
      },
    },
  ]);

  const messagesResult = await getMessagesForUsers({
    userIds: profileIdsToExport,
    messagingSupportSdk: workerM2MSdks.messaging.support,
    logger,
  });
  if (!messagesResult.success) {
    logger.error(
      { error: messagesResult.error },
      `[Export Data SDK] Failed to fetch messages for users ${profileIdsToExport.join(", ")}`,
    );
    return failed(messagesResult.error);
  }

  // Scope the export file set to the user's own message attachments (messaging
  // is the source of truth) instead of every file shared via files_users, which
  // was polluted by a bad migration cross-join and leaked other users' files.
  const fileIdsByUserId = getAttachmentFileIdsByUserId(messagesResult.data);

  const zipFileName = `profile-export-${profileId}-${randomUUID()}.zip`;
  const zipFilePath = join(tmpdir(), zipFileName);

  auditLogger.safeSendLogs([
    {
      ...exportDefaults,
      metadata: {
        ...defaultMetaValues,
        action: "zip_content",
      },
    },
  ]);

  const zip = new ZipArchive({ zlib: { level: 1 } });

  const output = createWriteStream(zipFilePath);
  zip.pipe(output);

  const expiresAt = new Date(
    Date.now() + UPLOAD_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const outputDone = new Promise<void>((resolve, reject) => {
    output.on("close", resolve);
    output.on("error", reject);
  });

  try {
    logger.info(
      { profileIdsToExport },
      `[Export Data SDK] Building export archive for user ${profileId}`,
    );

    appendStructuredDataToZip({
      zip,
      profileIds: profileIdsToExport,
      profileDataById,
      messagesByUserId: messagesResult.data,
    });

    logZipSize({
      zip,
      logger,
      logParams: { stage: "after_appending_structured_data" },
    });

    auditLogger.safeSendLogs([
      {
        ...exportDefaults,
        metadata: {
          ...defaultMetaValues,
          action: "zipped_profile_messages",
          profile_ids: profileIdsToExport,
        },
      },
    ]);

    const filesResult = await downloadAndZipFiles({
      fileIdsByUserId,
      uploadSupportSdk: workerM2MSdks.upload.support,
      zip,
      logger,
    });

    if (!filesResult.success) {
      logger.error(
        { error: filesResult.error },
        `[Export Data SDK] Failed to download and zip files for users ${profileIdsToExport.join(", ")}`,
      );
      return failed(filesResult.error);
    }

    logger.info(
      { profileIds: profileIdsToExport },
      `[Export Data SDK] Finished building archive for user`,
    );

    auditLogger.safeSendLogs([
      {
        ...exportDefaults,
        metadata: {
          ...defaultMetaValues,
          action: "zipped_files",
          file_id_source: "message_attachments",
        },
      },
    ]);

    await zip.finalize();
    await outputDone;

    logger.info({}, `[Export Data SDK] Finalized zip, uploading`);

    const uploadResult = await uploadExportArchive({
      uploadSupportSdk: workerM2MSdks.upload.support,
      zipFilePath,
      zipFileName,
      expiresAt,
      profileId,
      logger,
    });

    if ("error" in uploadResult) {
      logger.error(
        { error: uploadResult.error },
        `[Export Data SDK] Failed to upload export archive for user ${profileId}`,
      );
      return failed(uploadResult.error);
    }

    const uploadId = uploadResult.uploadId;

    auditLogger.safeSendLogs([
      {
        ...exportDefaults,
        metadata: {
          ...defaultMetaValues,
          action: "uploaded_export_archive",
          upload_id: uploadId,
        },
      },
    ]);

    logger.info(
      { zipFilePath, uploadId, profileId },
      `[Export Data SDK] Export completed for user`,
    );
    await notifyExportReady({
      notifyUser,
      profile,
      messagingSupportSdk: workerM2MSdks.messaging.support,
      logger,
      auditLogger,
      auditEntryDefaults: exportDefaults,
      auditMetadataDefaults: defaultMetaValues,
    });

    return success({ uploadId, expiresAt });
  } catch (err) {
    logger.error(
      { error: err },
      `[Export Data SDK] Error during export for user ${profileId}`,
    );
    auditLogger.safeSendLogs([
      {
        ...exportDefaults,
        successful: false,
        failure_reason: (err as Error).message,
      },
    ]);

    zip.abort();
    output.destroy();
    return failed(err);
  } finally {
    cleanupZipFile(zipFilePath, logger);
  }
}
