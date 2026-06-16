import { BatchRunStatus, SendAtMode } from "../domain/statuses.js";
import type { GroupedReportCount, RunStatusReport } from "../domain/types.js";

function describeHeadline(report: RunStatusReport): string {
  const { summary } = report;

  switch (summary.runStatus) {
    case BatchRunStatus.Completed:
      return `Batch Run ${summary.runId} completed successfully.`;
    case BatchRunStatus.CompletedWithFailures:
      return `Batch Run ${summary.runId} completed with send failures that need review.`;
    case BatchRunStatus.ReadyToSyncDelivery:
    case BatchRunStatus.SyncingDelivery:
      return `Batch Run ${summary.runId} is waiting for later delivery updates.`;
    case BatchRunStatus.Failed:
      return `Batch Run ${summary.runId} failed before completion.`;
    default:
      return `Batch Run ${summary.runId} is in progress.`;
  }
}

function describeSendTime(report: RunStatusReport): string {
  const { summary } = report;

  if (
    summary.sendAtMode === SendAtMode.Immediate ||
    summary.sendAtValue == null
  ) {
    return "immediate";
  }

  return summary.sendAtValue.toISOString();
}

function describeUnresolvedReason(group: GroupedReportCount): string {
  switch (group.label) {
    case "No profile match returned by findProfile":
      return `- ${group.count} recipients were not matched to a profile.`;
    case "Profile is not eligible for messaging":
      return `- ${group.count} recipients were excluded because the matched profile was not eligible for messaging.`;
    default:
      return `- ${group.count} recipients were excluded: ${group.label}.`;
  }
}

function describeNextStep(report: RunStatusReport): string {
  if (report.summary.awaitingSnapshots > 0) {
    return "- Re-run the command later to sync delivery updates once the delay window has elapsed.";
  }

  if (report.summary.terminalSendFailureMessages > 0) {
    return "- Investigate the grouped send failures before deciding whether to start a fresh Batch Run.";
  }

  if (
    report.summary.unresolvedRecipients > 0 ||
    report.summary.duplicateRecipients > 0
  ) {
    return "- Review the unresolved and duplicate-recipient outcomes before changing the CSV input.";
  }

  return "- No action needed.";
}

export function formatRunSummary(report: RunStatusReport): string {
  const attentionLines = [
    ...report.unresolvedRecipientReasons.map(describeUnresolvedReason),
    ...(report.summary.duplicateRecipients > 0
      ? [
          `- ${report.summary.duplicateRecipients} CSV rows were duplicates of an existing Canonical Message.`,
        ]
      : []),
    ...(report.summary.terminalSendFailureMessages > 0
      ? [
          `- ${report.summary.terminalSendFailureMessages} messages failed during sending.`,
        ]
      : []),
    ...report.failedDeliveryStatuses.map(
      (group) =>
        `- ${group.count} latest delivery snapshots are marked ${group.label}.`,
    ),
  ];

  return [
    describeHeadline(report),
    `Subject: ${report.summary.messageSubject}`,
    `Send time: ${describeSendTime(report)}`,
    "",
    "Attention needed",
    ...(attentionLines.length > 0
      ? attentionLines
      : ["- No exclusions or failures need attention."]),
    "",
    "Progress snapshot",
    `- ${report.summary.totalRecipients} CSV rows recorded in this Batch Run.`,
    `- ${report.summary.resolvedRecipients} recipients produced a Canonical Message.`,
    `- ${report.summary.sentMessages} messages were sent successfully.`,
    `- ${report.summary.terminalSendFailureMessages} messages ended in terminal send failure.`,
    "",
    "Delivery state",
    `- ${report.summary.messagesWithSnapshot} messages have a stored delivery snapshot.`,
    `- ${report.summary.successfulDeliveries} latest snapshots are successful.`,
    `- ${report.summary.failedDeliveries} latest snapshots are failed.`,
    `- ${report.deliverySyncReadiness.tooNewForSync} messages are still too new to sync.`,
    `- ${report.deliverySyncReadiness.eligibleWithoutSnapshot} messages are old enough for sync but still have no snapshot.`,
    "",
    "Next step",
    describeNextStep(report),
  ].join("\n");
}
