import { readFile } from "node:fs/promises";
import {
  BatchRunStatus,
  TemplateVariablesSchemaVersion,
} from "./domain/statuses.js";
import type {
  BatchRunRecord,
  BatchRunStore,
  FingerprintResult,
  LoadedConfig,
  LoggerAdapter,
  ResolvedSendAt,
  RunSummary,
} from "./domain/types.js";
import type { OperatorOutput } from "./logging/operator-output.js";

const RESOLVE_PHASE_STATUSES: readonly BatchRunRecord["status"][] = [
  BatchRunStatus.Created,
  BatchRunStatus.ResolvingRecipients,
];

const SEND_PHASE_STATUSES: readonly BatchRunRecord["status"][] = [
  BatchRunStatus.ReadyToSend,
  BatchRunStatus.Sending,
];

const SYNC_PHASE_STATUSES: readonly BatchRunRecord["status"][] = [
  BatchRunStatus.ReadyToSyncDelivery,
  BatchRunStatus.SyncingDelivery,
];

type RunPhases = {
  resolveRecipientsPhase: (args: {
    runId: string;
    scheduleAt: Date;
  }) => Promise<void>;
  sendMessagesPhase: (args: { runId: string }) => Promise<void>;
  syncDeliverySnapshotsPhase: (args: { runId: string }) => Promise<void>;
};

function resolveTerminalStatus(
  summary: Pick<
    RunSummary,
    "awaitingSnapshots" | "terminalSendFailureMessages"
  >,
): BatchRunRecord["status"] {
  if (summary.awaitingSnapshots > 0) {
    return BatchRunStatus.ReadyToSyncDelivery;
  }

  if (summary.terminalSendFailureMessages > 0) {
    return BatchRunStatus.CompletedWithFailures;
  }

  return BatchRunStatus.Completed;
}

function getRunSummaryOrThrow(
  summary: RunSummary | null,
  runId: string,
): RunSummary {
  if (summary == null) {
    throw new Error(`Missing run summary for ${runId}`);
  }

  return summary;
}

export async function runBatchCommand(params: {
  config: LoadedConfig;
  runFingerprint: FingerprintResult;
  resolvedSendAt: ResolvedSendAt;
  store: BatchRunStore;
  phases: RunPhases;
  logger: LoggerAdapter;
  operatorOutput: OperatorOutput;
}): Promise<{ runId: string }> {
  if (params.config.command.kind !== "run") {
    throw new Error("runBatchCommand only supports the run command");
  }

  const effectiveEventSyncDelaySeconds = resolveEffectiveEventSyncDelaySeconds(
    params.config,
  );
  const existingRun = await params.store.findLatestUnfinishedRunByFingerprint(
    params.runFingerprint.runFingerprint,
  );

  let run = existingRun;

  let supersededRunCount = 0;

  if (params.config.command.forceNew) {
    supersededRunCount =
      await params.store.supersedeUnfinishedRunsByFingerprint(
        params.runFingerprint.runFingerprint,
      );

    params.logger.info(
      {
        runFingerprint: params.runFingerprint.runFingerprint,
        supersededRuns: supersededRunCount,
      },
      "Superseded unfinished matching runs",
    );
    run = null;
  }

  if (run == null) {
    run = await params.store.createRun({
      runFingerprint: params.runFingerprint.runFingerprint,
      organizationId: params.config.publicServantOrganizationId,
      messageSubject: params.config.messageSubject,
      sendAtMode: params.resolvedSendAt.sendAtMode,
      sendAtValue: params.resolvedSendAt.sendAtValue,
      csvContentHash: params.runFingerprint.csvContentHash,
      htmlContentHash: params.runFingerprint.htmlContentHash,
      txtContentHash: params.runFingerprint.txtContentHash,
      templateVariablesSchemaVersion: TemplateVariablesSchemaVersion,
      operationalSettingsSnapshot: {
        sendBatchSize: params.config.sendBatchSize,
        sendBatchDelayMs: params.config.sendBatchDelayMs,
        eventSyncDelaySeconds: effectiveEventSyncDelaySeconds,
      },
    });

    params.logger.info(
      {
        runId: run.id,
        runFingerprint: run.runFingerprint,
      },
      "Created batch run",
    );

    params.operatorOutput.runStarted({
      runId: run.id,
      resumedFromStatus: null,
      supersededRuns: supersededRunCount,
      forceNew: params.config.command.forceNew,
    });
  } else {
    params.logger.info(
      {
        runId: run.id,
        runFingerprint: run.runFingerprint,
        runStatus: run.status,
      },
      "Resuming existing batch run",
    );

    params.operatorOutput.runStarted({
      runId: run.id,
      resumedFromStatus: run.status,
      supersededRuns: 0,
      forceNew: false,
    });
  }

  if (RESOLVE_PHASE_STATUSES.includes(run.status)) {
    await params.store.updateRunStatus(
      run.id,
      BatchRunStatus.ResolvingRecipients,
    );
    await params.phases.resolveRecipientsPhase({
      runId: run.id,
      scheduleAt: params.resolvedSendAt.scheduleAt,
    });
  }

  let summary = getRunSummaryOrThrow(
    await params.store.getRunSummary(run.id),
    run.id,
  );

  if (summary.pendingMessages > 0) {
    await params.store.updateRunStatus(run.id, BatchRunStatus.ReadyToSend);
  }

  if (summary.pendingMessages > 0 || SEND_PHASE_STATUSES.includes(run.status)) {
    await params.store.updateRunStatus(run.id, BatchRunStatus.Sending);
    await params.phases.sendMessagesPhase({ runId: run.id });
    summary = getRunSummaryOrThrow(
      await params.store.getRunSummary(run.id),
      run.id,
    );
  }

  if (summary.awaitingSnapshots > 0) {
    await params.store.updateRunStatus(
      run.id,
      BatchRunStatus.ReadyToSyncDelivery,
    );
  }

  if (
    summary.awaitingSnapshots > 0 ||
    SYNC_PHASE_STATUSES.includes(run.status)
  ) {
    await params.store.updateRunStatus(run.id, BatchRunStatus.SyncingDelivery);
    await params.phases.syncDeliverySnapshotsPhase({ runId: run.id });
    summary = getRunSummaryOrThrow(
      await params.store.getRunSummary(run.id),
      run.id,
    );
  }

  const terminalStatus = resolveTerminalStatus(summary);

  if (terminalStatus === BatchRunStatus.ReadyToSyncDelivery) {
    await params.store.updateRunStatus(run.id, terminalStatus);
  } else {
    await params.store.completeRun(run.id, terminalStatus);
  }

  params.operatorOutput.runCompleted({
    runId: run.id,
    terminalStatus,
    sentMessages: summary.sentMessages,
    terminalFailureCount: summary.terminalSendFailureMessages,
    awaitingSnapshots: summary.awaitingSnapshots,
  });

  params.logger.info(
    {
      runId: run.id,
      terminalStatus,
    },
    terminalStatus === BatchRunStatus.ReadyToSyncDelivery
      ? "Batch run still awaits delivery snapshots"
      : "Batch run reached a terminal status",
  );

  return { runId: run.id };
}

export async function loadTemplates(config: LoadedConfig): Promise<{
  htmlTemplate: string;
  txtTemplate: string;
}> {
  const [htmlTemplate, txtTemplate] = await Promise.all([
    readFile(config.htmlTemplatePath, "utf8"),
    readFile(config.txtTemplatePath, "utf8"),
  ]);

  return { htmlTemplate, txtTemplate };
}

export function resolveEffectiveEventSyncDelaySeconds(
  config: LoadedConfig,
): number {
  if (
    config.command.kind === "run" &&
    config.command.eventSyncDelaySeconds != null
  ) {
    return config.command.eventSyncDelaySeconds;
  }

  return config.eventSyncDelaySeconds;
}
