import { describe, expect, it } from "vitest";
import {
  BatchRunStatus,
  SendAtMode,
} from "../../../scripts/send-message-batches/domain/statuses.js";
import { formatRunSummary } from "../../../scripts/send-message-batches/status/format-run-summary.js";

describe("formatRunSummary", () => {
  it("prints the approved operator report sections", () => {
    const output = formatRunSummary({
      summary: {
        runId: "run-1",
        runStatus: BatchRunStatus.ReadyToSyncDelivery,
        runFingerprint: "fingerprint-1",
        organizationId: "org-1",
        messageSubject: "Wallet pilot",
        sendAtMode: SendAtMode.Immediate,
        sendAtValue: null,
        totalRecipients: 184,
        resolvedRecipients: 162,
        unresolvedRecipients: 18,
        duplicateRecipients: 4,
        totalMessages: 162,
        pendingMessages: 0,
        sentMessages: 159,
        terminalSendFailureMessages: 3,
        messagesWithSnapshot: 120,
        successfulDeliveries: 100,
        failedDeliveries: 20,
        awaitingSnapshots: 39,
      },
      unresolvedRecipientReasons: [
        {
          label: "No profile match returned by findProfile",
          count: 12,
        },
        {
          label: "Profile is not eligible for messaging",
          count: 6,
        },
      ],
      terminalSendFailureReasons: [
        {
          label: "Downstream send failed",
          count: 3,
        },
      ],
      failedDeliveryStatuses: [
        {
          label: "failed",
          count: 20,
        },
      ],
      deliverySyncReadiness: {
        tooNewForSync: 39,
        eligibleWithoutSnapshot: 0,
      },
    });

    expect(output).toContain(
      "Batch Run run-1 is waiting for later delivery updates.",
    );
    expect(output).toContain("Attention needed");
    expect(output).toContain("- 12 recipients were not matched to a profile.");
    expect(output).toContain(
      "- 6 recipients were excluded because the matched profile was not eligible for messaging.",
    );
    expect(output).toContain(
      "- 4 CSV rows were duplicates of an existing Canonical Message.",
    );
    expect(output).toContain("- 3 messages failed during sending.");
    expect(output).toContain("Delivery state");
    expect(output).toContain("- 39 messages are still too new to sync.");
    expect(output).toContain("Next step");
    expect(output).toContain(
      "Re-run the command later to sync delivery updates once the delay window has elapsed.",
    );
  });
});
