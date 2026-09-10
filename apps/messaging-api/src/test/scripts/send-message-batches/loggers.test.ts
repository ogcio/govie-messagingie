import { beforeEach, describe, expect, it, vi } from "vitest";
import { createNoopOperatorOutput } from "../../../scripts/send-message-batches/logging/operator-output.js";

const pinoInstance = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.mock("pino", () => {
  const pinoFn = () => pinoInstance;
  pinoFn.pino = pinoFn;
  return { default: pinoFn, pino: pinoFn };
});

const { createPinoLogger } = await import(
  "../../../scripts/send-message-batches/logging/create-pino-logger.js"
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createPinoLogger", () => {
  it("forwards each level to pino with fields first", () => {
    const logger = createPinoLogger();

    logger.debug({ a: 1 }, "debug msg");
    logger.info({ b: 2 }, "info msg");
    logger.warn({ c: 3 }, "warn msg");
    logger.error({ d: 4 }, "error msg");

    expect(pinoInstance.debug).toHaveBeenCalledWith({ a: 1 }, "debug msg");
    expect(pinoInstance.info).toHaveBeenCalledWith({ b: 2 }, "info msg");
    expect(pinoInstance.warn).toHaveBeenCalledWith({ c: 3 }, "warn msg");
    expect(pinoInstance.error).toHaveBeenCalledWith({ d: 4 }, "error msg");
  });
});

describe("createNoopOperatorOutput", () => {
  it("implements every operator output hook as a no-op", () => {
    const output = createNoopOperatorOutput();

    expect(() => {
      output.runStarted({
        runId: "run-1",
        resumedFromStatus: null,
        supersededRuns: 0,
        forceNew: false,
      });
      output.recipientsPhaseStarted({ recipientsCsvPath: "/tmp/r.csv" });
      output.recipientsPhaseCompleted({
        totalCsvRows: 0,
        resolvedRecipients: 0,
        duplicateRecipients: 0,
        unresolvedRecipientReasons: [],
        canonicalMessagesCreated: 0,
      });
      output.sendPhaseStarted({
        totalMessages: 0,
        sendBatchSize: 0,
        sendBatchDelayMs: 0,
      });
      output.sendBatchCompleted({
        batchIndex: 0,
        batchCount: 0,
        sentCount: 0,
        terminalFailureCount: 0,
        remainingCount: 0,
      });
      output.sendPhaseCompleted({
        totalMessages: 0,
        sentCount: 0,
        terminalFailureCount: 0,
      });
      output.deliverySyncPhaseStarted({ eligibleNow: 0, tooNewForSync: 0 });
      output.deliverySyncPhaseCompleted({
        syncedSnapshots: 0,
        checkedWithoutSnapshot: 0,
        tooNewForSync: 0,
      });
      output.runCompleted({
        runId: "run-1",
        terminalStatus: "completed",
        sentMessages: 0,
        terminalFailureCount: 0,
        awaitingSnapshots: 0,
      });
    }).not.toThrow();
  });
});
