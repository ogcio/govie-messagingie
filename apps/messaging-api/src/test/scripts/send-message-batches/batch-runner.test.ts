import { describe, expect, it, vi } from "vitest";
import { runBatchCommand } from "../../../scripts/send-message-batches/batch-runner.js";
import {
  BatchRunStatus,
  SendAtMode,
} from "../../../scripts/send-message-batches/domain/statuses.js";

const logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

function createOperatorOutput() {
  return {
    runStarted: vi.fn(),
    recipientsPhaseStarted: vi.fn(),
    recipientsPhaseCompleted: vi.fn(),
    sendPhaseStarted: vi.fn(),
    sendBatchCompleted: vi.fn(),
    sendPhaseCompleted: vi.fn(),
    deliverySyncPhaseStarted: vi.fn(),
    deliverySyncPhaseCompleted: vi.fn(),
    runCompleted: vi.fn(),
  };
}

describe("runBatchCommand", () => {
  it("reuses an unfinished matching run when force-new is false", async () => {
    const store = {
      findLatestUnfinishedRunByFingerprint: vi.fn().mockResolvedValue({
        id: "run-1",
        runFingerprint: "fingerprint-1",
        status: BatchRunStatus.ReadyToSend,
        organizationId: "org-1",
        messageSubject: "Wallet pilot",
        sendAtMode: SendAtMode.Immediate,
        sendAtValue: null,
        createdAt: new Date("2026-05-26T10:00:00.000Z"),
        completedAt: null,
      }),
      createRun: vi.fn(),
      supersedeUnfinishedRunsByFingerprint: vi.fn(),
      updateRunStatus: vi.fn(),
      completeRun: vi.fn(),
      getRunSummary: vi.fn().mockResolvedValue({
        runId: "run-1",
        runStatus: BatchRunStatus.Completed,
        runFingerprint: "fingerprint-1",
        organizationId: "org-1",
        messageSubject: "Wallet pilot",
        sendAtMode: SendAtMode.Immediate,
        sendAtValue: null,
        totalRecipients: 1,
        resolvedRecipients: 1,
        unresolvedRecipients: 0,
        duplicateRecipients: 0,
        totalMessages: 1,
        pendingMessages: 0,
        sentMessages: 1,
        terminalSendFailureMessages: 0,
        messagesWithSnapshot: 1,
        successfulDeliveries: 1,
        failedDeliveries: 0,
        awaitingSnapshots: 0,
      }),
    };

    const phases = {
      resolveRecipientsPhase: vi.fn(),
      sendMessagesPhase: vi.fn(),
      syncDeliverySnapshotsPhase: vi.fn(),
    };

    const result = await runBatchCommand({
      config: {
        command: {
          kind: "run",
          forceNew: false,
          sendAt: undefined,
          eventSyncDelaySeconds: undefined,
        },
      } as never,
      runFingerprint: {
        runFingerprint: "fingerprint-1",
        csvContentHash: "csv",
        htmlContentHash: "html",
        txtContentHash: "txt",
      },
      resolvedSendAt: {
        sendAtMode: SendAtMode.Immediate,
        fingerprintValue: "immediate",
        scheduleAt: new Date("2026-05-26T10:00:00.000Z"),
        sendAtValue: null,
      },
      store: store as never,
      phases: phases as never,
      logger,
      operatorOutput: createOperatorOutput(),
    });

    expect(store.createRun).not.toHaveBeenCalled();
    expect(result.runId).toBe("run-1");
  });

  it("marks completed_with_failures when no resumable work remains and send failures exist", async () => {
    const store = {
      findLatestUnfinishedRunByFingerprint: vi.fn().mockResolvedValue(null),
      createRun: vi.fn().mockResolvedValue({
        id: "run-2",
        runFingerprint: "fingerprint-2",
        status: BatchRunStatus.Created,
        organizationId: "org-1",
        messageSubject: "Wallet pilot",
        sendAtMode: SendAtMode.Immediate,
        sendAtValue: null,
        createdAt: new Date("2026-05-26T10:00:00.000Z"),
        completedAt: null,
      }),
      supersedeUnfinishedRunsByFingerprint: vi.fn(),
      updateRunStatus: vi.fn(),
      completeRun: vi.fn(),
      getRunSummary: vi.fn().mockResolvedValue({
        runId: "run-2",
        runStatus: BatchRunStatus.Sending,
        runFingerprint: "fingerprint-2",
        organizationId: "org-1",
        messageSubject: "Wallet pilot",
        sendAtMode: SendAtMode.Immediate,
        sendAtValue: null,
        totalRecipients: 1,
        resolvedRecipients: 1,
        unresolvedRecipients: 0,
        duplicateRecipients: 0,
        totalMessages: 1,
        pendingMessages: 0,
        sentMessages: 0,
        terminalSendFailureMessages: 1,
        messagesWithSnapshot: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        awaitingSnapshots: 0,
      }),
    };

    const phases = {
      resolveRecipientsPhase: vi.fn(),
      sendMessagesPhase: vi.fn(),
      syncDeliverySnapshotsPhase: vi.fn(),
    };

    await runBatchCommand({
      config: {
        command: {
          kind: "run",
          forceNew: false,
          sendAt: undefined,
          eventSyncDelaySeconds: undefined,
        },
        publicServantOrganizationId: "org-1",
        messageSubject: "Wallet pilot",
        sendBatchSize: 50,
        sendBatchDelayMs: 250,
        eventSyncDelaySeconds: 1800,
      } as never,
      runFingerprint: {
        runFingerprint: "fingerprint-2",
        csvContentHash: "csv",
        htmlContentHash: "html",
        txtContentHash: "txt",
      },
      resolvedSendAt: {
        sendAtMode: SendAtMode.Immediate,
        fingerprintValue: "immediate",
        scheduleAt: new Date("2026-05-26T10:00:00.000Z"),
        sendAtValue: null,
      },
      store: store as never,
      phases: phases as never,
      logger,
      operatorOutput: createOperatorOutput(),
    });

    expect(store.completeRun).toHaveBeenCalledWith(
      "run-2",
      BatchRunStatus.CompletedWithFailures,
    );
  });

  it("calls runStarted with resumedFromStatus and runCompleted when resuming an existing run", async () => {
    const existingRun = {
      id: "run-3",
      runFingerprint: "fingerprint-3",
      status: BatchRunStatus.Sending,
      organizationId: "org-1",
      messageSubject: "Wallet pilot",
      sendAtMode: SendAtMode.Immediate,
      sendAtValue: null,
      createdAt: new Date("2026-05-26T10:00:00.000Z"),
      completedAt: null,
    };

    const store = {
      findLatestUnfinishedRunByFingerprint: vi
        .fn()
        .mockResolvedValue(existingRun),
      createRun: vi.fn(),
      supersedeUnfinishedRunsByFingerprint: vi.fn(),
      updateRunStatus: vi.fn(),
      completeRun: vi.fn(),
      getRunSummary: vi.fn().mockResolvedValue({
        runId: "run-3",
        runStatus: BatchRunStatus.Completed,
        runFingerprint: "fingerprint-3",
        organizationId: "org-1",
        messageSubject: "Wallet pilot",
        sendAtMode: SendAtMode.Immediate,
        sendAtValue: null,
        totalRecipients: 2,
        resolvedRecipients: 2,
        unresolvedRecipients: 0,
        duplicateRecipients: 0,
        totalMessages: 2,
        pendingMessages: 0,
        sentMessages: 2,
        terminalSendFailureMessages: 0,
        messagesWithSnapshot: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        awaitingSnapshots: 0,
      }),
    };

    const phases = {
      resolveRecipientsPhase: vi.fn(),
      sendMessagesPhase: vi.fn(),
      syncDeliverySnapshotsPhase: vi.fn(),
    };

    const operatorOutput = createOperatorOutput();

    await runBatchCommand({
      config: {
        command: {
          kind: "run",
          forceNew: false,
          sendAt: undefined,
          eventSyncDelaySeconds: undefined,
        },
        publicServantOrganizationId: "org-1",
        messageSubject: "Wallet pilot",
        sendBatchSize: 50,
        sendBatchDelayMs: 250,
        eventSyncDelaySeconds: 1800,
      } as never,
      runFingerprint: {
        runFingerprint: "fingerprint-3",
        csvContentHash: "csv",
        htmlContentHash: "html",
        txtContentHash: "txt",
      },
      resolvedSendAt: {
        sendAtMode: SendAtMode.Immediate,
        fingerprintValue: "immediate",
        scheduleAt: new Date("2026-05-26T10:00:00.000Z"),
        sendAtValue: null,
      },
      store: store as never,
      phases: phases as never,
      logger,
      operatorOutput,
    });

    expect(operatorOutput.runStarted).toHaveBeenCalledWith({
      runId: "run-3",
      resumedFromStatus: BatchRunStatus.Sending,
      supersededRuns: 0,
      forceNew: false,
    });

    expect(operatorOutput.runCompleted).toHaveBeenCalledWith({
      runId: "run-3",
      terminalStatus: BatchRunStatus.Completed,
      sentMessages: 2,
      terminalFailureCount: 0,
      awaitingSnapshots: 0,
    });
  });
});
