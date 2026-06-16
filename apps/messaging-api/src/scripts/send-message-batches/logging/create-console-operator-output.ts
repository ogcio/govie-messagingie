import { BatchRunStatus } from "../domain/statuses.js";
import type { GroupedReportCount } from "../domain/types.js";
import type { OperatorOutput } from "./operator-output.js";

type WriteLine = (line: string) => void;

function describeReason(group: GroupedReportCount): string {
  switch (group.label) {
    case "No profile match returned by findProfile":
      return `${group.count} not matched to a profile`;
    case "Profile is not eligible for messaging":
      return `${group.count} not eligible for messaging`;
    default:
      return `${group.count} ${group.label}`;
  }
}

export function createConsoleOperatorOutput(
  params: { writeLine?: WriteLine } = {},
): OperatorOutput {
  const writeLine = params.writeLine ?? console.info.bind(console);

  return {
    runStarted({ runId, resumedFromStatus, supersededRuns, forceNew }) {
      if (resumedFromStatus != null) {
        writeLine(`Resuming Batch Run ${runId} from ${resumedFromStatus}.`);
        return;
      }

      if (forceNew && supersededRuns > 0) {
        writeLine(
          `Starting a fresh Batch Run and superseding ${supersededRuns} unfinished matching run${supersededRuns === 1 ? "" : "s"}.`,
        );
      } else {
        writeLine("Starting a new Batch Run for this input set.");
      }

      writeLine(`Batch Run: ${runId}`);
    },

    recipientsPhaseStarted() {
      writeLine(
        "Resolving recipients from CSV and checking profile eligibility.",
      );
    },

    recipientsPhaseCompleted({
      totalCsvRows,
      resolvedRecipients,
      duplicateRecipients,
      unresolvedRecipientReasons,
      canonicalMessagesCreated,
    }) {
      writeLine(
        `Recipient resolution complete: ${totalCsvRows} rows processed, ${canonicalMessagesCreated} eligible deliveries created.`,
      );

      const excludedParts = [
        ...unresolvedRecipientReasons.map(describeReason),
        ...(duplicateRecipients > 0
          ? [`${duplicateRecipients} duplicates`]
          : []),
      ];

      if (excludedParts.length > 0) {
        writeLine(`Excluded recipients: ${excludedParts.join(", ")}.`);
      }

      if (resolvedRecipients === 0) {
        writeLine("No eligible deliveries were created in this Batch Run.");
      }
    },

    sendPhaseStarted({ totalMessages, sendBatchSize }) {
      const batchCount = Math.ceil(totalMessages / sendBatchSize);
      writeLine(
        `Sending ${totalMessages} Canonical Messages in ${batchCount} batch${batchCount === 1 ? "" : "es"} of up to ${sendBatchSize}.`,
      );
    },

    sendBatchCompleted({
      batchIndex,
      batchCount,
      sentCount,
      terminalFailureCount,
      remainingCount,
    }) {
      writeLine(
        `Batch ${batchIndex} of ${batchCount} complete: ${sentCount} sent, ${terminalFailureCount} failed, ${remainingCount} remaining.`,
      );
    },

    sendPhaseCompleted({ sentCount, terminalFailureCount }) {
      writeLine(
        `Send phase complete: ${sentCount} sent, ${terminalFailureCount} failed.`,
      );
    },

    deliverySyncPhaseStarted({ eligibleNow, tooNewForSync }) {
      writeLine(
        `Checking delivery updates for ${eligibleNow} sent message${eligibleNow === 1 ? "" : "s"} that are old enough to sync.`,
      );

      if (tooNewForSync > 0) {
        writeLine(
          `${tooNewForSync} sent message${tooNewForSync === 1 ? " is" : "s are"} still too new to sync.`,
        );
      }
    },

    deliverySyncPhaseCompleted({
      syncedSnapshots,
      checkedWithoutSnapshot,
      tooNewForSync,
    }) {
      writeLine(
        `Delivery sync complete: ${syncedSnapshots} message${syncedSnapshots === 1 ? " now has" : "s now have"} a delivery snapshot.`,
      );

      if (checkedWithoutSnapshot > 0) {
        writeLine(
          `${checkedWithoutSnapshot} eligible message${checkedWithoutSnapshot === 1 ? " still has" : "s still have"} no delivery snapshot yet.`,
        );
      }

      if (tooNewForSync > 0) {
        writeLine(
          `${tooNewForSync} message${tooNewForSync === 1 ? " is" : "s are"} still too new to check.`,
        );
      }
    },

    runCompleted({ terminalStatus, terminalFailureCount, awaitingSnapshots }) {
      switch (terminalStatus) {
        case BatchRunStatus.Completed:
          writeLine("Batch Run completed successfully.");
          return;
        case BatchRunStatus.CompletedWithFailures:
          writeLine(
            `Batch Run completed with issues to review. ${terminalFailureCount} messages failed to send.`,
          );
          return;
        case BatchRunStatus.ReadyToSyncDelivery:
          writeLine(
            `Batch Run is waiting for later delivery updates. ${awaitingSnapshots} delivery snapshots are still pending.`,
          );
          return;
        default:
          writeLine("Batch Run failed before completion.");
      }
    },
  };
}
