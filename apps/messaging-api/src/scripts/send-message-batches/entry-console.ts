import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CommanderError } from "commander";
import {
  loadTemplates,
  resolveEffectiveEventSyncDelaySeconds,
  runBatchCommand,
} from "./batch-runner.js";
import { parseCliArgs } from "./cli.js";
import { createSdkClients } from "./clients/create-sdk-clients.js";
import { createPublicServantTokenClient } from "./clients/public-servant-token-client.js";
import { computeRunFingerprint } from "./config/compute-run-fingerprint.js";
import { loadConfig } from "./config/load-config.js";
import { resolveSendAt } from "./config/resolve-send-at.js";
import { createBatchRunStore } from "./database/batch-run-store.js";
import { createBatchDatabase } from "./database/create-database.js";
import { migrateBatchDatabase } from "./database/migrate.js";
import { createDatabasePool } from "./database/shared.js";
import { TemplateVariablesSchemaVersion } from "./domain/statuses.js";
import { createConsoleLogger } from "./logging/create-console-logger.js";
import { createConsoleOperatorOutput } from "./logging/create-console-operator-output.js";
import { resolveRecipientsPhase } from "./phases/resolve-recipients-phase.js";
import { sendMessagesPhase } from "./phases/send-messages-phase.js";
import { syncDeliverySnapshotsPhase } from "./phases/sync-delivery-snapshots-phase.js";
import { formatRunSummary } from "./status/format-run-summary.js";
import { getRunSummaryForStatus } from "./status/get-run-summary.js";

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

async function main(): Promise<void> {
  const logger = createConsoleLogger();
  const operatorOutput = createConsoleOperatorOutput();
  const scriptRoot = dirname(fileURLToPath(import.meta.url));
  let pool: ReturnType<typeof createDatabasePool> | undefined;

  try {
    const config = await loadConfig({
      env: process.env,
      cli: parseCliArgs(process.argv.slice(2)),
      scriptRoot,
    });

    await createBatchDatabase(config.database);
    await migrateBatchDatabase(config.database);

    pool = createDatabasePool(config.database);
    const store = createBatchRunStore(pool);

    if (config.command.kind === "status") {
      const summary = await getRunSummaryForStatus({
        config,
        store,
        now: new Date(),
      });

      if (summary == null) {
        throw new Error("No matching batch run found");
      }

      console.log(formatRunSummary(summary));
      return;
    }

    const tokenClient = createPublicServantTokenClient({
      tokenEndpoint: `${config.logtoOidcEndpoint}token`,
      clientId: config.publicServantClientId,
      clientSecret: config.publicServantClientSecret,
      organizationId: config.publicServantOrganizationId,
      scopes: config.publicServantScopes,
    });
    const { profile, messaging } = createSdkClients({
      profileBackendUrl: config.profileBackendUrl,
      messagingBackendUrl: config.messagingBackendUrl,
      tokenClient,
      richTextEncodeBase64: config.richTextEncodeBase64,
    });
    const { htmlTemplate, txtTemplate } = await loadTemplates(config);
    const resolvedSendAt = resolveSendAt({
      sendAt: config.command.sendAt,
      now: new Date(),
    });
    const runFingerprint = await computeRunFingerprint({
      organizationId: config.publicServantOrganizationId,
      recipientsCsvPath: config.recipientsCsvPath,
      htmlTemplatePath: config.htmlTemplatePath,
      txtTemplatePath: config.txtTemplatePath,
      messageSubject: config.messageSubject,
      templateVariablesSchemaVersion: TemplateVariablesSchemaVersion,
      resolvedSendAt,
    });

    await runBatchCommand({
      config,
      runFingerprint,
      resolvedSendAt,
      store,
      logger,
      operatorOutput,
      phases: {
        resolveRecipientsPhase: ({ runId, scheduleAt }) =>
          resolveRecipientsPhase({
            runId,
            store,
            profileClient: profile,
            logger,
            operatorOutput,
            recipientsCsvPath: config.recipientsCsvPath,
            scheduleAt,
          }),
        sendMessagesPhase: ({ runId }) =>
          sendMessagesPhase({
            runId,
            store,
            messagingClient: messaging,
            logger,
            operatorOutput,
            subject: config.messageSubject,
            htmlTemplate,
            txtTemplate,
            sendBatchSize: config.sendBatchSize,
            sendBatchDelayMs: config.sendBatchDelayMs,
            sleep,
          }),
        syncDeliverySnapshotsPhase: ({ runId }) =>
          syncDeliverySnapshotsPhase({
            runId,
            store,
            messagingClient: messaging,
            logger,
            operatorOutput,
            eventSyncDelaySeconds:
              resolveEffectiveEventSyncDelaySeconds(config),
            now: new Date(),
          }),
      },
    });
  } catch (error) {
    if (!(error instanceof CommanderError)) {
      logger.error({ err: error }, "send-message-batches failed");
    }

    throw error;
  } finally {
    await pool?.end();
  }
}

try {
  await main();
} catch (error) {
  if (error instanceof CommanderError) {
    process.exitCode = error.exitCode;
  } else {
    throw error;
  }
}
