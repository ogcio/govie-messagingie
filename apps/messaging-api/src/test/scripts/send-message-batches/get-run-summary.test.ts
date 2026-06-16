import { describe, expect, it, vi } from "vitest";
import {
  BatchRunStatus,
  SendAtMode,
} from "../../../scripts/send-message-batches/domain/statuses.js";
import { getRunSummaryForStatus } from "../../../scripts/send-message-batches/status/get-run-summary.js";

describe("getRunSummaryForStatus", () => {
  it("combines the base summary with grouped reporting data", async () => {
    const now = new Date("2026-05-27T10:00:00.000Z");

    const summary = {
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
    };

    const store = {
      getRunSummary: vi.fn().mockResolvedValue(summary),
      listUnresolvedRecipientReasonCounts: vi.fn().mockResolvedValue([
        {
          label: "No profile match returned by findProfile",
          count: 12,
        },
        {
          label: "Profile is not eligible for messaging",
          count: 6,
        },
      ]),
      listTerminalSendFailureReasonCounts: vi.fn().mockResolvedValue([
        {
          label: "Downstream send failed",
          count: 3,
        },
      ]),
      listFailedDeliveryStatusCounts: vi.fn().mockResolvedValue([
        {
          label: "failed",
          count: 20,
        },
      ]),
      countMessagesTooNewForDeliverySync: vi.fn().mockResolvedValue(39),
    };

    const report = await getRunSummaryForStatus({
      config: {
        command: {
          kind: "status",
          runId: "run-1",
          sendAt: undefined,
        },
        eventSyncDelaySeconds: 1800,
      } as never,
      store: store as never,
      now,
    });

    expect(report).toEqual({
      summary,
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
  });
});
