import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBatchRunStore } from "../../../scripts/send-message-batches/database/batch-run-store.js";
import { createBatchDatabase } from "../../../scripts/send-message-batches/database/create-database.js";
import { migrateBatchDatabase } from "../../../scripts/send-message-batches/database/migrate.js";
import { createDatabasePool } from "../../../scripts/send-message-batches/database/shared.js";
import {
  BatchRunStatus,
  SendAtMode,
} from "../../../scripts/send-message-batches/domain/statuses.js";
import type { DatabaseConfig } from "../../../scripts/send-message-batches/domain/types.js";
import {
  getConfigFromContainer,
  startPostgresContainer,
} from "../../build-testcontainer-pg.js";

let container: StartedPostgreSqlContainer;

beforeAll(async () => {
  container = await startPostgresContainer();
}, 120_000);

afterAll(async () => {
  await container.stop();
});

describe("batch sender store", () => {
  it("creates a run, returns it as active, and supersedes it", async () => {
    const database = createDatabaseConfig("store_one");

    await createBatchDatabase(database);
    await migrateBatchDatabase(database);

    const pool = createDatabasePool(database);

    try {
      const store = createBatchRunStore(pool);

      const run = await store.createRun({
        runFingerprint: "fingerprint-1",
        organizationId: "org-1",
        messageSubject: "Wallet pilot",
        sendAtMode: SendAtMode.Immediate,
        sendAtValue: null,
        csvContentHash: "csv-hash",
        htmlContentHash: "html-hash",
        txtContentHash: "txt-hash",
        templateVariablesSchemaVersion: "v1",
        operationalSettingsSnapshot: {
          sendBatchSize: 50,
          sendBatchDelayMs: 250,
          eventSyncDelaySeconds: 1800,
        },
      });

      expect(
        (await store.findLatestUnfinishedRunByFingerprint("fingerprint-1"))?.id,
      ).toBe(run.id);
      expect(
        await store.supersedeUnfinishedRunsByFingerprint("fingerprint-1"),
      ).toBe(1);
      expect(
        await store.findLatestUnfinishedRunByFingerprint("fingerprint-1"),
      ).toBeNull();
    } finally {
      await pool.end();
    }
  }, 120_000);

  it("reuses the unfinished run when concurrent creates race on one fingerprint", async () => {
    const database = createDatabaseConfig("store_race");

    await createBatchDatabase(database);
    await migrateBatchDatabase(database);

    const pool = createDatabasePool(database);

    try {
      const store = createBatchRunStore(pool);
      const createRunInput = {
        runFingerprint: "fingerprint-race",
        organizationId: "org-1",
        messageSubject: "Wallet pilot",
        sendAtMode: SendAtMode.Immediate,
        sendAtValue: null,
        csvContentHash: "csv-hash",
        htmlContentHash: "html-hash",
        txtContentHash: "txt-hash",
        templateVariablesSchemaVersion: "v1",
        operationalSettingsSnapshot: {
          sendBatchSize: 50,
          sendBatchDelayMs: 250,
          eventSyncDelaySeconds: 1800,
        },
      };

      const [firstRun, secondRun] = await Promise.all([
        store.createRun(createRunInput),
        store.createRun(createRunInput),
      ]);

      expect(firstRun.id).toBe(secondRun.id);
      expect(
        (await store.findLatestUnfinishedRunByFingerprint("fingerprint-race"))
          ?.id,
      ).toBe(firstRun.id);
    } finally {
      await pool.end();
    }
  }, 120_000);

  it("stores recipients and returns messages eligible for sync in send order", async () => {
    const database = createDatabaseConfig("store_two");

    await createBatchDatabase(database);
    await migrateBatchDatabase(database);

    const pool = createDatabasePool(database);

    try {
      const store = createBatchRunStore(pool);

      const run = await store.createRun({
        runFingerprint: "fingerprint-2",
        organizationId: "org-1",
        messageSubject: "Wallet pilot",
        sendAtMode: SendAtMode.Immediate,
        sendAtValue: null,
        csvContentHash: "csv-hash",
        htmlContentHash: "html-hash",
        txtContentHash: "txt-hash",
        templateVariablesSchemaVersion: "v1",
        operationalSettingsSnapshot: {
          sendBatchSize: 50,
          sendBatchDelayMs: 250,
          eventSyncDelaySeconds: 1800,
        },
      });

      await store.insertRecipients(run.id, [
        {
          csvRowNumber: 1,
          rawEmail: "one@example.com",
          normalizedEmail: "one@example.com",
        },
        {
          csvRowNumber: 2,
          rawEmail: "two@example.com",
          normalizedEmail: "two@example.com",
        },
      ]);

      const [firstRecipient, secondRecipient] =
        await store.listPendingRecipients(run.id);

      const firstMessage = await store.createPendingMessage({
        runId: run.id,
        sourceRecipientId: firstRecipient.id,
        profileId: "profile-1",
        recipientEmail: "one@example.com",
        templatePublicName: "One",
        templateEmail: "one@example.com",
        scheduleAt: new Date("2026-05-26T10:00:00.000Z"),
      });

      const secondMessage = await store.createPendingMessage({
        runId: run.id,
        sourceRecipientId: secondRecipient.id,
        profileId: "profile-2",
        recipientEmail: "two@example.com",
        templatePublicName: "Two",
        templateEmail: "two@example.com",
        scheduleAt: new Date("2026-05-26T10:00:00.000Z"),
      });

      await store.markRecipientResolved({
        recipientId: firstRecipient.id,
        profileId: "profile-1",
        publicName: "One",
        profileEmail: "one@example.com",
        consentStatus: "opted-in",
        profileStatus: "active",
        canonicalMessageId: firstMessage.id,
      });

      await store.markRecipientResolved({
        recipientId: secondRecipient.id,
        profileId: "profile-2",
        publicName: "Two",
        profileEmail: "two@example.com",
        consentStatus: "opted-in",
        profileStatus: "active",
        canonicalMessageId: secondMessage.id,
      });

      await store.markMessageSent({
        messageId: secondMessage.id,
        externalMessageId: "msg-2",
        renderedSubject: "Wallet pilot",
        renderedPlainText: "hello two",
        renderedRichText: "<p>hello two</p>",
      });
      await store.markMessageSent({
        messageId: firstMessage.id,
        externalMessageId: "msg-1",
        renderedSubject: "Wallet pilot",
        renderedPlainText: "hello one",
        renderedRichText: "<p>hello one</p>",
      });

      const eligible = await store.listMessagesEligibleForDeliverySync(
        run.id,
        0,
        new Date(),
      );

      expect(eligible.map((item) => item.externalMessageId)).toEqual([
        "msg-2",
        "msg-1",
      ]);

      const summary = await store.getRunSummary(run.id);
      expect(summary).toMatchObject({
        totalRecipients: 2,
        resolvedRecipients: 2,
        totalMessages: 2,
        pendingMessages: 0,
        sentMessages: 2,
        awaitingSnapshots: 2,
      });
    } finally {
      await pool.end();
    }
  }, 120_000);

  it("persists recipient snapshots, latest delivery snapshots, and latest matching summaries", async () => {
    const database = createDatabaseConfig("store_three");

    await createBatchDatabase(database);
    await migrateBatchDatabase(database);

    const pool = createDatabasePool(database);

    try {
      const store = createBatchRunStore(pool);

      await store.createRun({
        runFingerprint: "fingerprint-3",
        organizationId: "org-1",
        messageSubject: "Older wallet pilot",
        sendAtMode: SendAtMode.Immediate,
        sendAtValue: null,
        csvContentHash: "csv-hash-old",
        htmlContentHash: "html-hash-old",
        txtContentHash: "txt-hash-old",
        templateVariablesSchemaVersion: "v1",
        operationalSettingsSnapshot: {
          sendBatchSize: 50,
          sendBatchDelayMs: 250,
          eventSyncDelaySeconds: 1800,
        },
      });

      const run = await store.createRun({
        runFingerprint: "fingerprint-3",
        organizationId: "org-1",
        messageSubject: "Wallet pilot",
        sendAtMode: SendAtMode.Immediate,
        sendAtValue: null,
        csvContentHash: "csv-hash-new",
        htmlContentHash: "html-hash-new",
        txtContentHash: "txt-hash-new",
        templateVariablesSchemaVersion: "v1",
        operationalSettingsSnapshot: {
          sendBatchSize: 50,
          sendBatchDelayMs: 250,
          eventSyncDelaySeconds: 1800,
        },
      });

      await store.insertRecipients(run.id, [
        {
          csvRowNumber: 1,
          rawEmail: "one@example.com",
          normalizedEmail: "one@example.com",
        },
        {
          csvRowNumber: 2,
          rawEmail: "duplicate@example.com",
          normalizedEmail: "duplicate@example.com",
        },
        {
          csvRowNumber: 3,
          rawEmail: "blocked@example.com",
          normalizedEmail: "blocked@example.com",
        },
        {
          csvRowNumber: 4,
          rawEmail: "failed@example.com",
          normalizedEmail: "failed@example.com",
        },
      ]);

      const [
        primaryRecipient,
        duplicateRecipient,
        unresolvedRecipient,
        failingRecipient,
      ] = await store.listPendingRecipients(run.id);

      const successMessage = await store.createPendingMessage({
        runId: run.id,
        sourceRecipientId: primaryRecipient.id,
        profileId: "profile-1",
        recipientEmail: "one@example.com",
        templatePublicName: "One",
        templateEmail: "one@example.com",
        scheduleAt: new Date("2026-05-26T10:00:00.000Z"),
      });

      const failingMessage = await store.createPendingMessage({
        runId: run.id,
        sourceRecipientId: failingRecipient.id,
        profileId: "profile-2",
        recipientEmail: "failed@example.com",
        templatePublicName: "Failure",
        templateEmail: "failed@example.com",
        scheduleAt: new Date("2026-05-26T10:00:00.000Z"),
      });

      await store.markRecipientResolved({
        recipientId: primaryRecipient.id,
        profileId: "profile-1",
        publicName: "One",
        profileEmail: "one@example.com",
        consentStatus: "opted-in",
        profileStatus: "active",
        canonicalMessageId: successMessage.id,
      });

      await store.markRecipientDuplicate({
        recipientId: duplicateRecipient.id,
        canonicalMessageId: successMessage.id,
        profileId: "profile-1",
        publicName: "One",
        profileEmail: "one@example.com",
        consentStatus: "opted-in",
        profileStatus: "active",
      });

      await store.markRecipientUnresolved({
        recipientId: unresolvedRecipient.id,
        reason: "Recipient not eligible",
        profileId: "profile-3",
        publicName: "Blocked",
        profileEmail: "blocked@example.com",
        consentStatus: "opted-out",
        profileStatus: "active",
      });

      await store.markRecipientResolved({
        recipientId: failingRecipient.id,
        profileId: "profile-2",
        publicName: "Failure",
        profileEmail: "failed@example.com",
        consentStatus: "opted-in",
        profileStatus: "active",
        canonicalMessageId: failingMessage.id,
      });

      await store.markMessageSent({
        messageId: successMessage.id,
        externalMessageId: "msg-success",
        renderedSubject: "Wallet pilot",
        renderedPlainText: "hello one",
        renderedRichText: "<p>hello one</p>",
      });

      await store.storeLatestDeliverySnapshot({
        messageId: successMessage.id,
        snapshot: {
          eventType: "delivered",
          eventStatus: "successful",
          eventPayload: { provider: "email" },
          eventAt: new Date("2026-05-26T10:05:00.000Z"),
        },
        syncedAt: new Date("2026-05-26T10:06:00.000Z"),
      });

      await store.storeLatestDeliverySnapshot({
        messageId: successMessage.id,
        snapshot: {
          eventType: "deleted",
          eventStatus: "failed",
          eventPayload: { provider: "email" },
          eventAt: new Date("2026-05-26T10:04:00.000Z"),
        },
        syncedAt: new Date("2026-05-26T10:07:00.000Z"),
      });

      await store.markMessageTerminalFailure(
        failingMessage.id,
        "Downstream send failed",
      );
      await store.completeRun(run.id, BatchRunStatus.CompletedWithFailures);

      const recipientSnapshotResult = await pool.query<{
        csvRowNumber: number;
        resolutionStatus: string;
        resolutionReason: string | null;
        profileId: string | null;
        publicName: string | null;
        profileEmail: string | null;
        consentStatus: string | null;
        profileStatus: string | null;
        canonicalMessageId: string | null;
      }>(
        `
          select
            csv_row_number as "csvRowNumber",
            resolution_status as "resolutionStatus",
            resolution_reason as "resolutionReason",
            profile_id as "profileId",
            public_name as "publicName",
            profile_email as "profileEmail",
            consent_status as "consentStatus",
            profile_status as "profileStatus",
            canonical_message_id as "canonicalMessageId"
          from batch_recipients
          where run_id = $1
          order by csv_row_number asc
        `,
        [run.id],
      );

      expect(recipientSnapshotResult.rows).toEqual([
        {
          csvRowNumber: 1,
          resolutionStatus: "resolved",
          resolutionReason: null,
          profileId: "profile-1",
          publicName: "One",
          profileEmail: "one@example.com",
          consentStatus: "opted-in",
          profileStatus: "active",
          canonicalMessageId: successMessage.id,
        },
        {
          csvRowNumber: 2,
          resolutionStatus: "duplicate",
          resolutionReason: null,
          profileId: "profile-1",
          publicName: "One",
          profileEmail: "one@example.com",
          consentStatus: "opted-in",
          profileStatus: "active",
          canonicalMessageId: successMessage.id,
        },
        {
          csvRowNumber: 3,
          resolutionStatus: "unresolved",
          resolutionReason: "Recipient not eligible",
          profileId: "profile-3",
          publicName: "Blocked",
          profileEmail: "blocked@example.com",
          consentStatus: "opted-out",
          profileStatus: "active",
          canonicalMessageId: null,
        },
        {
          csvRowNumber: 4,
          resolutionStatus: "resolved",
          resolutionReason: null,
          profileId: "profile-2",
          publicName: "Failure",
          profileEmail: "failed@example.com",
          consentStatus: "opted-in",
          profileStatus: "active",
          canonicalMessageId: failingMessage.id,
        },
      ]);

      const messageSnapshotResult = await pool.query<{
        deliveryEventStatus: string | null;
        successful: boolean | null;
      }>(
        `
          select
            delivery_event_status as "deliveryEventStatus",
            successful
          from batch_messages
          where id = $1
        `,
        [successMessage.id],
      );

      expect(messageSnapshotResult.rows).toEqual([
        {
          deliveryEventStatus: "successful",
          successful: true,
        },
      ]);

      const latestSummary =
        await store.findLatestRunSummaryByFingerprint("fingerprint-3");

      expect(latestSummary).toMatchObject({
        runId: run.id,
        runStatus: BatchRunStatus.CompletedWithFailures,
        totalRecipients: 4,
        resolvedRecipients: 2,
        unresolvedRecipients: 1,
        duplicateRecipients: 1,
        totalMessages: 2,
        pendingMessages: 0,
        sentMessages: 1,
        terminalSendFailureMessages: 1,
        messagesWithSnapshot: 1,
        successfulDeliveries: 1,
        failedDeliveries: 0,
        awaitingSnapshots: 0,
      });
    } finally {
      await pool.end();
    }
  }, 120_000);

  it("groups operator reporting data from recipient, send, and delivery state", async () => {
    const database = createDatabaseConfig("store_reporting");

    await createBatchDatabase(database);
    await migrateBatchDatabase(database);

    const pool = createDatabasePool(database);

    try {
      const store = createBatchRunStore(pool);

      const run = await store.createRun({
        runFingerprint: "fingerprint-reporting",
        organizationId: "org-1",
        messageSubject: "Wallet pilot",
        sendAtMode: SendAtMode.Immediate,
        sendAtValue: null,
        csvContentHash: "csv-hash",
        htmlContentHash: "html-hash",
        txtContentHash: "txt-hash",
        templateVariablesSchemaVersion: "v1",
        operationalSettingsSnapshot: {
          sendBatchSize: 50,
          sendBatchDelayMs: 250,
          eventSyncDelaySeconds: 1800,
        },
      });

      await store.insertRecipients(run.id, [
        {
          csvRowNumber: 1,
          rawEmail: "delivered@example.com",
          normalizedEmail: "delivered@example.com",
        },
        {
          csvRowNumber: 2,
          rawEmail: "waiting@example.com",
          normalizedEmail: "waiting@example.com",
        },
        {
          csvRowNumber: 3,
          rawEmail: "failed-delivery@example.com",
          normalizedEmail: "failed-delivery@example.com",
        },
        {
          csvRowNumber: 4,
          rawEmail: "send-failure@example.com",
          normalizedEmail: "send-failure@example.com",
        },
        {
          csvRowNumber: 5,
          rawEmail: "missing@example.com",
          normalizedEmail: "missing@example.com",
        },
        {
          csvRowNumber: 6,
          rawEmail: "duplicate@example.com",
          normalizedEmail: "duplicate@example.com",
        },
      ]);

      const [
        deliveredRecipient,
        waitingRecipient,
        failedDeliveryRecipient,
        sendFailureRecipient,
        unresolvedRecipient,
        duplicateRecipient,
      ] = await store.listPendingRecipients(run.id);

      const deliveredMessage = await store.createPendingMessage({
        runId: run.id,
        sourceRecipientId: deliveredRecipient.id,
        profileId: "profile-1",
        recipientEmail: "delivered@example.com",
        templatePublicName: "Delivered",
        templateEmail: "delivered@example.com",
        scheduleAt: new Date("2026-05-26T10:00:00.000Z"),
      });

      const waitingMessage = await store.createPendingMessage({
        runId: run.id,
        sourceRecipientId: waitingRecipient.id,
        profileId: "profile-2",
        recipientEmail: "waiting@example.com",
        templatePublicName: "Waiting",
        templateEmail: "waiting@example.com",
        scheduleAt: new Date("2026-05-26T10:00:00.000Z"),
      });

      const failedDeliveryMessage = await store.createPendingMessage({
        runId: run.id,
        sourceRecipientId: failedDeliveryRecipient.id,
        profileId: "profile-3",
        recipientEmail: "failed-delivery@example.com",
        templatePublicName: "Delivery Failure",
        templateEmail: "failed-delivery@example.com",
        scheduleAt: new Date("2026-05-26T10:00:00.000Z"),
      });

      const sendFailureMessage = await store.createPendingMessage({
        runId: run.id,
        sourceRecipientId: sendFailureRecipient.id,
        profileId: "profile-4",
        recipientEmail: "send-failure@example.com",
        templatePublicName: "Send Failure",
        templateEmail: "send-failure@example.com",
        scheduleAt: new Date("2026-05-26T10:00:00.000Z"),
      });

      await store.markRecipientResolved({
        recipientId: deliveredRecipient.id,
        profileId: "profile-1",
        publicName: "Delivered",
        profileEmail: "delivered@example.com",
        consentStatus: "opted-in",
        profileStatus: "active",
        canonicalMessageId: deliveredMessage.id,
      });

      await store.markRecipientResolved({
        recipientId: waitingRecipient.id,
        profileId: "profile-2",
        publicName: "Waiting",
        profileEmail: "waiting@example.com",
        consentStatus: "opted-in",
        profileStatus: "active",
        canonicalMessageId: waitingMessage.id,
      });

      await store.markRecipientResolved({
        recipientId: failedDeliveryRecipient.id,
        profileId: "profile-3",
        publicName: "Delivery Failure",
        profileEmail: "failed-delivery@example.com",
        consentStatus: "opted-in",
        profileStatus: "active",
        canonicalMessageId: failedDeliveryMessage.id,
      });

      await store.markRecipientResolved({
        recipientId: sendFailureRecipient.id,
        profileId: "profile-4",
        publicName: "Send Failure",
        profileEmail: "send-failure@example.com",
        consentStatus: "opted-in",
        profileStatus: "active",
        canonicalMessageId: sendFailureMessage.id,
      });

      await store.markRecipientUnresolved({
        recipientId: unresolvedRecipient.id,
        reason: "No profile match returned by findProfile",
      });

      await store.markRecipientDuplicate({
        recipientId: duplicateRecipient.id,
        canonicalMessageId: deliveredMessage.id,
        profileId: "profile-1",
        publicName: "Delivered",
        profileEmail: "delivered@example.com",
        consentStatus: "opted-in",
        profileStatus: "active",
      });

      await store.markMessageSent({
        messageId: deliveredMessage.id,
        externalMessageId: "msg-delivered",
        renderedSubject: "Wallet pilot",
        renderedPlainText: "hello delivered",
        renderedRichText: "<p>hello delivered</p>",
      });

      await store.markMessageSent({
        messageId: waitingMessage.id,
        externalMessageId: "msg-waiting",
        renderedSubject: "Wallet pilot",
        renderedPlainText: "hello waiting",
        renderedRichText: "<p>hello waiting</p>",
      });

      await store.markMessageSent({
        messageId: failedDeliveryMessage.id,
        externalMessageId: "msg-delivery-failed",
        renderedSubject: "Wallet pilot",
        renderedPlainText: "hello failed delivery",
        renderedRichText: "<p>hello failed delivery</p>",
      });

      await store.markMessageTerminalFailure(
        sendFailureMessage.id,
        "Downstream send failed",
      );

      await store.storeLatestDeliverySnapshot({
        messageId: deliveredMessage.id,
        snapshot: {
          eventType: "delivered",
          eventStatus: "successful",
          eventPayload: { provider: "email" },
          eventAt: new Date("2026-05-26T10:05:00.000Z"),
        },
        syncedAt: new Date("2026-05-26T10:06:00.000Z"),
      });

      await store.storeLatestDeliverySnapshot({
        messageId: failedDeliveryMessage.id,
        snapshot: {
          eventType: "deleted",
          eventStatus: "failed",
          eventPayload: { provider: "email" },
          eventAt: new Date("2026-05-26T10:05:00.000Z"),
        },
        syncedAt: new Date("2026-05-26T10:06:00.000Z"),
      });

      expect(await store.listUnresolvedRecipientReasonCounts(run.id)).toEqual([
        {
          label: "No profile match returned by findProfile",
          count: 1,
        },
      ]);

      expect(await store.listTerminalSendFailureReasonCounts(run.id)).toEqual([
        {
          label: "Downstream send failed",
          count: 1,
        },
      ]);

      expect(await store.listFailedDeliveryStatusCounts(run.id)).toEqual([
        {
          label: "failed",
          count: 1,
        },
      ]);

      expect(
        await store.countMessagesTooNewForDeliverySync(
          run.id,
          3600,
          new Date(),
        ),
      ).toBe(1);
    } finally {
      await pool.end();
    }
  }, 120_000);
});

function createDatabaseConfig(suffix: string): DatabaseConfig {
  const baseConfig = getConfigFromContainer(container);

  return {
    user: baseConfig.POSTGRES_USER,
    password: baseConfig.POSTGRES_PASSWORD,
    host: baseConfig.POSTGRES_HOST,
    port: baseConfig.POSTGRES_PORT,
    databaseName: `${baseConfig.POSTGRES_DB_NAME}_${suffix}`,
  };
}
