import { describe, expect, it, vi } from "vitest";
import type {
  BatchRunStore,
  LoggerAdapter,
  MessagingClient,
} from "../../../scripts/send-message-batches/domain/types.js";
import { sendMessagesPhase } from "../../../scripts/send-message-batches/phases/send-messages-phase.js";

function createLogger(): LoggerAdapter {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

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

describe("sendMessagesPhase", () => {
  it("renders, sends, stores the message id, and sleeps between batches", async () => {
    const store = {
      listPendingMessages: vi
        .fn<BatchRunStore["listPendingMessages"]>()
        .mockResolvedValue([
          {
            id: "message-1",
            profileId: "profile-1",
            recipientEmail: "one@example.com",
            templatePublicName: "One",
            templateEmail: "one@example.com",
            scheduleAt: new Date("2026-05-26T10:00:00.000Z"),
          },
          {
            id: "message-2",
            profileId: "profile-2",
            recipientEmail: "two@example.com",
            templatePublicName: "Two",
            templateEmail: "two@example.com",
            scheduleAt: new Date("2026-05-26T10:00:00.000Z"),
          },
        ]),
      markMessageSent: vi
        .fn<BatchRunStore["markMessageSent"]>()
        .mockResolvedValue(undefined),
      markMessageTerminalFailure: vi
        .fn<BatchRunStore["markMessageTerminalFailure"]>()
        .mockResolvedValue(undefined),
    } satisfies Pick<
      BatchRunStore,
      "listPendingMessages" | "markMessageSent" | "markMessageTerminalFailure"
    >;

    const messagingClient = {
      sendMessage: vi
        .fn<MessagingClient["sendMessage"]>()
        .mockResolvedValueOnce({ messageId: "external-1" })
        .mockResolvedValueOnce({ messageId: "external-2" }),
    } satisfies Pick<MessagingClient, "sendMessage">;

    const sleep = vi.fn().mockResolvedValue(undefined);

    const operatorOutput = createOperatorOutput();

    await sendMessagesPhase({
      runId: "run-1",
      store,
      messagingClient,
      logger: createLogger(),
      operatorOutput,
      subject: "Wallet pilot",
      htmlTemplate: "<p>Hello {{publicName}}</p>",
      txtTemplate: "Hello {{publicName}}",
      sendBatchSize: 1,
      sendBatchDelayMs: 250,
      sleep,
    });

    expect(messagingClient.sendMessage).toHaveBeenCalledTimes(2);
    expect(messagingClient.sendMessage).toHaveBeenNthCalledWith(1, {
      recipientProfileId: "profile-1",
      recipientEmail: "one@example.com",
      scheduleAt: new Date("2026-05-26T10:00:00.000Z"),
      content: {
        threadName: "Wallet pilot",
        subject: "Wallet pilot",
        excerpt: "Hello One",
        plainText: "Hello One",
        richText: "<p>Hello One</p>",
      },
    });
    expect(store.markMessageSent).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(250);

    expect(operatorOutput.sendPhaseStarted).toHaveBeenCalledWith({
      totalMessages: 2,
      sendBatchSize: 1,
      sendBatchDelayMs: 250,
    });
    expect(operatorOutput.sendBatchCompleted).toHaveBeenCalledTimes(2);
    expect(operatorOutput.sendBatchCompleted).toHaveBeenNthCalledWith(1, {
      batchIndex: 1,
      batchCount: 2,
      sentCount: 1,
      terminalFailureCount: 0,
      remainingCount: 1,
    });
    expect(operatorOutput.sendBatchCompleted).toHaveBeenNthCalledWith(2, {
      batchIndex: 2,
      batchCount: 2,
      sentCount: 2,
      terminalFailureCount: 0,
      remainingCount: 0,
    });
    expect(operatorOutput.sendPhaseCompleted).toHaveBeenCalledWith({
      totalMessages: 2,
      sentCount: 2,
      terminalFailureCount: 0,
    });
  });

  it("records terminal send failures without retrying", async () => {
    const store = {
      listPendingMessages: vi
        .fn<BatchRunStore["listPendingMessages"]>()
        .mockResolvedValue([
          {
            id: "message-1",
            profileId: "profile-1",
            recipientEmail: "one@example.com",
            templatePublicName: "One",
            templateEmail: "one@example.com",
            scheduleAt: new Date("2026-05-26T10:00:00.000Z"),
          },
        ]),
      markMessageSent: vi
        .fn<BatchRunStore["markMessageSent"]>()
        .mockResolvedValue(undefined),
      markMessageTerminalFailure: vi
        .fn<BatchRunStore["markMessageTerminalFailure"]>()
        .mockResolvedValue(undefined),
    } satisfies Pick<
      BatchRunStore,
      "listPendingMessages" | "markMessageSent" | "markMessageTerminalFailure"
    >;

    const messagingClient = {
      sendMessage: vi
        .fn<MessagingClient["sendMessage"]>()
        .mockRejectedValue(new Error("send failed")),
    } satisfies Pick<MessagingClient, "sendMessage">;

    await sendMessagesPhase({
      runId: "run-1",
      store,
      messagingClient,
      logger: createLogger(),
      operatorOutput: createOperatorOutput(),
      subject: "Wallet pilot",
      htmlTemplate: "<p>Hello {{publicName}}</p>",
      txtTemplate: "Hello {{publicName}}",
      sendBatchSize: 50,
      sendBatchDelayMs: 0,
      sleep: async () => undefined,
    });

    expect(messagingClient.sendMessage).toHaveBeenCalledTimes(1);
    expect(store.markMessageTerminalFailure).toHaveBeenCalledWith(
      "message-1",
      "send failed",
    );
  });
});
