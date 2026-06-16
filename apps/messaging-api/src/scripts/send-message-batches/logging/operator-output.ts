import type { BatchRunStatusValue } from "../domain/statuses.js";
import type { GroupedReportCount } from "../domain/types.js";

export interface OperatorOutput {
  runStarted(params: {
    runId: string;
    resumedFromStatus: BatchRunStatusValue | null;
    supersededRuns: number;
    forceNew: boolean;
  }): void;
  recipientsPhaseStarted(params: { recipientsCsvPath: string }): void;
  recipientsPhaseCompleted(params: {
    totalCsvRows: number;
    resolvedRecipients: number;
    duplicateRecipients: number;
    unresolvedRecipientReasons: GroupedReportCount[];
    canonicalMessagesCreated: number;
  }): void;
  sendPhaseStarted(params: {
    totalMessages: number;
    sendBatchSize: number;
    sendBatchDelayMs: number;
  }): void;
  sendBatchCompleted(params: {
    batchIndex: number;
    batchCount: number;
    sentCount: number;
    terminalFailureCount: number;
    remainingCount: number;
  }): void;
  sendPhaseCompleted(params: {
    totalMessages: number;
    sentCount: number;
    terminalFailureCount: number;
  }): void;
  deliverySyncPhaseStarted(params: {
    eligibleNow: number;
    tooNewForSync: number;
  }): void;
  deliverySyncPhaseCompleted(params: {
    syncedSnapshots: number;
    checkedWithoutSnapshot: number;
    tooNewForSync: number;
  }): void;
  runCompleted(params: {
    runId: string;
    terminalStatus: BatchRunStatusValue;
    sentMessages: number;
    terminalFailureCount: number;
    awaitingSnapshots: number;
  }): void;
}

export function createNoopOperatorOutput(): OperatorOutput {
  return {
    runStarted() {},
    recipientsPhaseStarted() {},
    recipientsPhaseCompleted() {},
    sendPhaseStarted() {},
    sendBatchCompleted() {},
    sendPhaseCompleted() {},
    deliverySyncPhaseStarted() {},
    deliverySyncPhaseCompleted() {},
    runCompleted() {},
  };
}
