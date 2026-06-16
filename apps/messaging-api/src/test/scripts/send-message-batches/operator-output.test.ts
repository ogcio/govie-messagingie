import { afterEach, describe, expect, it, vi } from "vitest";
import { BatchRunStatus } from "../../../scripts/send-message-batches/domain/statuses.js";
import { createConsoleLogger } from "../../../scripts/send-message-batches/logging/create-console-logger.js";
import { createConsoleOperatorOutput } from "../../../scripts/send-message-batches/logging/create-console-operator-output.js";

describe("createConsoleOperatorOutput", () => {
  it("prints guided run and batch progress messages", () => {
    const lines: string[] = [];
    const output = createConsoleOperatorOutput({
      writeLine: (line) => lines.push(line),
    });

    output.runStarted({
      runId: "run-1",
      resumedFromStatus: null,
      supersededRuns: 0,
      forceNew: false,
    });

    output.recipientsPhaseStarted({
      recipientsCsvPath: "/tmp/recipients.csv",
    });

    output.recipientsPhaseCompleted({
      totalCsvRows: 184,
      resolvedRecipients: 162,
      duplicateRecipients: 4,
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
      canonicalMessagesCreated: 162,
    });

    output.sendPhaseStarted({
      totalMessages: 162,
      sendBatchSize: 50,
      sendBatchDelayMs: 250,
    });

    output.sendBatchCompleted({
      batchIndex: 2,
      batchCount: 4,
      sentCount: 98,
      terminalFailureCount: 2,
      remainingCount: 62,
    });

    output.sendPhaseCompleted({
      totalMessages: 162,
      sentCount: 159,
      terminalFailureCount: 3,
    });

    output.runCompleted({
      runId: "run-1",
      terminalStatus: BatchRunStatus.CompletedWithFailures,
      sentMessages: 159,
      terminalFailureCount: 3,
      awaitingSnapshots: 0,
    });

    expect(lines).toEqual([
      "Starting a new Batch Run for this input set.",
      "Batch Run: run-1",
      "Resolving recipients from CSV and checking profile eligibility.",
      "Recipient resolution complete: 184 rows processed, 162 eligible deliveries created.",
      "Excluded recipients: 12 not matched to a profile, 6 not eligible for messaging, 4 duplicates.",
      "Sending 162 Canonical Messages in 4 batches of up to 50.",
      "Batch 2 of 4 complete: 98 sent, 2 failed, 62 remaining.",
      "Send phase complete: 159 sent, 3 failed.",
      "Batch Run completed with issues to review. 3 messages failed to send.",
    ]);
  });
});

describe("createConsoleLogger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("suppresses debug noise but still prints warnings", () => {
    const debug = vi
      .spyOn(console, "debug")
      .mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const logger = createConsoleLogger();

    logger.debug({ messageId: "message-1" }, "Sent canonical message");
    logger.warn(
      { sendError: "send failed" },
      "Message send failed without retry",
    );

    expect(debug).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      'Message send failed without retry {"sendError":"send failed"}',
    );
  });
});
