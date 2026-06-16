import { computeRunFingerprint } from "../config/compute-run-fingerprint.js";
import { resolveSendAt } from "../config/resolve-send-at.js";
import { TemplateVariablesSchemaVersion } from "../domain/statuses.js";
import type {
  BatchRunStore,
  LoadedConfig,
  RunStatusReport,
} from "../domain/types.js";

export async function getRunSummaryForStatus(params: {
  config: LoadedConfig;
  store: Pick<
    BatchRunStore,
    | "getRunSummary"
    | "findLatestRunSummaryByFingerprint"
    | "listUnresolvedRecipientReasonCounts"
    | "listTerminalSendFailureReasonCounts"
    | "listFailedDeliveryStatusCounts"
    | "countMessagesTooNewForDeliverySync"
  >;
  now: Date;
}): Promise<RunStatusReport | null> {
  const summary =
    params.config.command.kind === "status" &&
    params.config.command.runId != null
      ? await params.store.getRunSummary(params.config.command.runId)
      : await getLatestMatchingSummary(params);

  if (summary == null) {
    return null;
  }

  const tooNewForSync = await params.store.countMessagesTooNewForDeliverySync(
    summary.runId,
    params.config.eventSyncDelaySeconds,
    params.now,
  );

  return {
    summary,
    unresolvedRecipientReasons:
      await params.store.listUnresolvedRecipientReasonCounts(summary.runId),
    terminalSendFailureReasons:
      await params.store.listTerminalSendFailureReasonCounts(summary.runId),
    failedDeliveryStatuses: await params.store.listFailedDeliveryStatusCounts(
      summary.runId,
    ),
    deliverySyncReadiness: {
      tooNewForSync,
      eligibleWithoutSnapshot: Math.max(
        summary.awaitingSnapshots - tooNewForSync,
        0,
      ),
    },
  };
}

async function getLatestMatchingSummary(params: {
  config: LoadedConfig;
  store: Pick<BatchRunStore, "findLatestRunSummaryByFingerprint">;
  now: Date;
}) {
  const resolvedSendAt = resolveSendAt({
    sendAt: params.config.command.sendAt,
    now: params.now,
  });

  const fingerprint = await computeRunFingerprint({
    organizationId: params.config.publicServantOrganizationId,
    recipientsCsvPath: params.config.recipientsCsvPath,
    htmlTemplatePath: params.config.htmlTemplatePath,
    txtTemplatePath: params.config.txtTemplatePath,
    messageSubject: params.config.messageSubject,
    templateVariablesSchemaVersion: TemplateVariablesSchemaVersion,
    resolvedSendAt,
  });

  return params.store.findLatestRunSummaryByFingerprint(
    fingerprint.runFingerprint,
  );
}
