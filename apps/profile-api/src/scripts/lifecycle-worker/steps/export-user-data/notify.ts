import type { Messaging } from "@ogcio/building-blocks-sdk/dist/types/index.js";
import type pino from "pino";
import type { AuditLogResourceType } from "~/types/audit-logger.js";
import type { AuditLogger } from "~/utils/audit-logger.js";
import {
  buildExportSucceededMessageContent,
  sendPublicMessage,
} from "./messages.js";

/**
 * A non-null requester_application_id means an M2M application (today, only
 * messaging-support) asked for the export on the citizen's behalf. Those
 * exports land in the same row the citizen portal reads, so the export
 * remains visible and downloadable there — the citizen is simply not
 * proactively notified that it exists.
 */
export function shouldNotifyRequester(task: {
  requester_application_id: string | null;
}): boolean {
  return task.requester_application_id === null;
}

export async function notifyExportReady(params: {
  notifyUser: boolean;
  profile: { id: string; publicName: string; preferredLanguage?: "en" | "ga" };
  messagingSupportSdk: Messaging["support"];
  logger: pino.Logger;
  auditLogger: AuditLogger<"user_id" | "metadata" | "client_timestamp">;
  auditEntryDefaults: {
    action_type: "read";
    resource_type: AuditLogResourceType;
    parent_log_entry_id: string | undefined;
  };
  auditMetadataDefaults: Record<string, unknown>;
}): Promise<void> {
  const {
    notifyUser,
    profile,
    messagingSupportSdk,
    logger,
    auditLogger,
    auditEntryDefaults,
    auditMetadataDefaults,
  } = params;

  if (!notifyUser) {
    logger.info(
      { profileId: profile.id },
      "[Export Data SDK] Export requested by an application, skipping citizen notification",
    );
    auditLogger.safeSendLogs([
      {
        ...auditEntryDefaults,
        metadata: {
          ...auditMetadataDefaults,
          action: "skipped_export_succeeded_message",
          reason: "requested_by_application",
        },
      },
    ]);
    return;
  }

  const sendMessageResult = await sendPublicMessage({
    profile,
    messagingSupportSdk,
    logger,
    message: buildExportSucceededMessageContent({
      publicName: profile.publicName,
    }),
  });

  auditLogger.safeSendLogs([
    {
      ...auditEntryDefaults,
      metadata: {
        ...auditMetadataDefaults,
        action: "sent_export_succeeded_message",
        message_id: sendMessageResult.success
          ? sendMessageResult.messageId
          : undefined,
        message_error: !sendMessageResult.success
          ? sendMessageResult.error
          : undefined,
      },
    },
  ]);
}
