import type { Pool } from "pg";
import {
  BatchRunStatus,
  MessageSendStatus,
  RecipientResolutionStatus,
} from "../domain/statuses.js";
import type {
  BatchRunRecord,
  BatchRunStore,
  DeliveryEvent,
  RunSummary,
} from "../domain/types.js";

const TERMINAL_RUN_STATUSES = [
  BatchRunStatus.Completed,
  BatchRunStatus.CompletedWithFailures,
  BatchRunStatus.Failed,
  BatchRunStatus.Superseded,
] as const;

type BatchRunRow = {
  id: string;
  runFingerprint: string;
  status: BatchRunRecord["status"];
  organizationId: string;
  messageSubject: string;
  sendAtMode: BatchRunRecord["sendAtMode"];
  sendAtValue: Date | null;
  createdAt: Date;
  completedAt: Date | null;
};

type CanonicalMessageIdRow = {
  id: string;
};

type PendingRecipientRow = {
  id: string;
  csvRowNumber: number;
  rawEmail: string;
  normalizedEmail: string;
};

type PendingMessageRow = {
  id: string;
  profileId: string;
  recipientEmail: string;
  templatePublicName: string | null;
  templateEmail: string;
  scheduleAt: Date;
};

type DeliverySyncCandidateRow = {
  id: string;
  externalMessageId: string;
};

type GroupedReportCountRow = {
  label: string;
  count: number;
};

type CountRow = {
  count: number;
};

type RunIdRow = {
  id: string;
};

type PgErrorWithCode = {
  code?: string;
};

function mapRun(row: BatchRunRow): BatchRunRecord {
  return {
    id: row.id,
    runFingerprint: row.runFingerprint,
    status: row.status,
    organizationId: row.organizationId,
    messageSubject: row.messageSubject,
    sendAtMode: row.sendAtMode,
    sendAtValue: row.sendAtValue,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  };
}

function deriveDeliverySuccess(snapshot: DeliveryEvent): boolean | null {
  if (snapshot.eventStatus === "successful") {
    return true;
  }

  if (snapshot.eventStatus === "failed" || snapshot.eventStatus === "deleted") {
    return false;
  }

  return null;
}

function isUniqueViolation(error: unknown): error is PgErrorWithCode {
  return (
    typeof error === "object" &&
    error != null &&
    "code" in error &&
    (error as PgErrorWithCode).code === "23505"
  );
}

export function createBatchRunStore(pool: Pool): BatchRunStore {
  async function findLatestUnfinishedRunByFingerprint(
    runFingerprint: string,
  ): Promise<BatchRunRecord | null> {
    const { rows } = await pool.query<BatchRunRow>(
      `
        select
          id,
          run_fingerprint as "runFingerprint",
          status,
          organization_id as "organizationId",
          message_subject as "messageSubject",
          send_at_mode as "sendAtMode",
          send_at_value as "sendAtValue",
          created_at as "createdAt",
          completed_at as "completedAt"
        from batch_runs
        where run_fingerprint = $1
          and status <> all($2::text[])
        order by created_at desc
        limit 1
      `,
      [runFingerprint, TERMINAL_RUN_STATUSES],
    );

    return rows[0] == null ? null : mapRun(rows[0]);
  }

  return {
    findLatestUnfinishedRunByFingerprint,

    async findRunById(runId) {
      const { rows } = await pool.query<BatchRunRow>(
        `
          select
            id,
            run_fingerprint as "runFingerprint",
            status,
            organization_id as "organizationId",
            message_subject as "messageSubject",
            send_at_mode as "sendAtMode",
            send_at_value as "sendAtValue",
            created_at as "createdAt",
            completed_at as "completedAt"
          from batch_runs
          where id = $1
        `,
        [runId],
      );

      return rows[0] == null ? null : mapRun(rows[0]);
    },

    async createRun(params) {
      try {
        const { rows } = await pool.query<BatchRunRow>(
          `
            insert into batch_runs (
              run_fingerprint,
              status,
              organization_id,
              message_subject,
              send_at_mode,
              send_at_value,
              csv_content_hash,
              html_content_hash,
              txt_content_hash,
              template_variables_schema_version,
              operational_settings_snapshot
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            returning
              id,
              run_fingerprint as "runFingerprint",
              status,
              organization_id as "organizationId",
              message_subject as "messageSubject",
              send_at_mode as "sendAtMode",
              send_at_value as "sendAtValue",
              created_at as "createdAt",
              completed_at as "completedAt"
          `,
          [
            params.runFingerprint,
            BatchRunStatus.Created,
            params.organizationId,
            params.messageSubject,
            params.sendAtMode,
            params.sendAtValue,
            params.csvContentHash,
            params.htmlContentHash,
            params.txtContentHash,
            params.templateVariablesSchemaVersion,
            params.operationalSettingsSnapshot,
          ],
        );

        return mapRun(rows[0]);
      } catch (error) {
        if (isUniqueViolation(error)) {
          const existingRun = await findLatestUnfinishedRunByFingerprint(
            params.runFingerprint,
          );

          if (existingRun != null) {
            return existingRun;
          }
        }

        throw error;
      }
    },

    async supersedeUnfinishedRunsByFingerprint(runFingerprint) {
      const result = await pool.query(
        `
          update batch_runs
          set
            status = $2,
            updated_at = now(),
            completed_at = now()
          where run_fingerprint = $1
            and status <> all($3::text[])
        `,
        [runFingerprint, BatchRunStatus.Superseded, TERMINAL_RUN_STATUSES],
      );

      return result.rowCount ?? 0;
    },

    async insertRecipients(runId, recipients) {
      for (const recipient of recipients) {
        await pool.query(
          `
            insert into batch_recipients (
              run_id,
              csv_row_number,
              raw_email,
              normalized_email,
              resolution_status
            )
            values ($1, $2, $3, $4, $5)
          `,
          [
            runId,
            recipient.csvRowNumber,
            recipient.rawEmail,
            recipient.normalizedEmail,
            RecipientResolutionStatus.Pending,
          ],
        );
      }
    },

    async listPendingRecipients(runId) {
      const { rows } = await pool.query<PendingRecipientRow>(
        `
          select
            id,
            csv_row_number as "csvRowNumber",
            raw_email as "rawEmail",
            normalized_email as "normalizedEmail"
          from batch_recipients
          where run_id = $1
            and resolution_status = $2
          order by csv_row_number asc
        `,
        [runId, RecipientResolutionStatus.Pending],
      );

      return rows;
    },

    async markRecipientResolved(params) {
      await pool.query(
        `
          update batch_recipients
          set
            resolution_status = $2,
            profile_id = $3,
            public_name = $4,
            profile_email = $5,
            consent_status = $6,
            profile_status = $7,
            canonical_message_id = $8,
            updated_at = now()
          where id = $1
        `,
        [
          params.recipientId,
          RecipientResolutionStatus.Resolved,
          params.profileId,
          params.publicName,
          params.profileEmail,
          params.consentStatus,
          params.profileStatus,
          params.canonicalMessageId,
        ],
      );
    },

    async markRecipientUnresolved(params) {
      await pool.query(
        `
          update batch_recipients
          set
            resolution_status = $2,
            resolution_reason = $3,
            profile_id = $4,
            public_name = $5,
            profile_email = $6,
            consent_status = $7,
            profile_status = $8,
            updated_at = now()
          where id = $1
        `,
        [
          params.recipientId,
          RecipientResolutionStatus.Unresolved,
          params.reason,
          params.profileId ?? null,
          params.publicName ?? null,
          params.profileEmail ?? null,
          params.consentStatus ?? null,
          params.profileStatus ?? null,
        ],
      );
    },

    async markRecipientDuplicate(params) {
      await pool.query(
        `
          update batch_recipients
          set
            resolution_status = $2,
            canonical_message_id = $3,
            profile_id = $4,
            public_name = $5,
            profile_email = $6,
            consent_status = $7,
            profile_status = $8,
            updated_at = now()
          where id = $1
        `,
        [
          params.recipientId,
          RecipientResolutionStatus.Duplicate,
          params.canonicalMessageId,
          params.profileId ?? null,
          params.publicName ?? null,
          params.profileEmail ?? null,
          params.consentStatus ?? null,
          params.profileStatus ?? null,
        ],
      );
    },

    async findCanonicalMessageByProfileId(runId, profileId) {
      const { rows } = await pool.query<CanonicalMessageIdRow>(
        `
          select id
          from batch_messages
          where run_id = $1
            and profile_id = $2
        `,
        [runId, profileId],
      );

      return rows[0] ?? null;
    },

    async createPendingMessage(params) {
      const { rows } = await pool.query<CanonicalMessageIdRow>(
        `
          insert into batch_messages (
            run_id,
            source_recipient_id,
            profile_id,
            recipient_email,
            template_public_name,
            template_email,
            schedule_at,
            send_status
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8)
          returning id
        `,
        [
          params.runId,
          params.sourceRecipientId,
          params.profileId,
          params.recipientEmail,
          params.templatePublicName,
          params.templateEmail,
          params.scheduleAt,
          MessageSendStatus.Pending,
        ],
      );

      return rows[0];
    },

    async listPendingMessages(runId) {
      const { rows } = await pool.query<PendingMessageRow>(
        `
          select
            id,
            profile_id as "profileId",
            recipient_email as "recipientEmail",
            template_public_name as "templatePublicName",
            template_email as "templateEmail",
            schedule_at as "scheduleAt"
          from batch_messages
          where run_id = $1
            and send_status = $2
          order by created_at asc, id asc
        `,
        [runId, MessageSendStatus.Pending],
      );

      return rows;
    },

    async markMessageSent(params) {
      await pool.query(
        `
          with target_run as (
            select run_id
            from batch_messages
            where id = $1
          ),
          next_order as (
            select
              target_run.run_id,
              coalesce(max(existing_message.sent_order_index), 0) + 1 as next_sent_order_index
            from target_run
            left join batch_messages as existing_message
              on existing_message.run_id = target_run.run_id
            group by target_run.run_id
          )
          update batch_messages as batch_message
          set
            send_status = $2,
            external_message_id = $3,
            rendered_subject = $4,
            rendered_plain_text = $5,
            rendered_rich_text = $6,
            send_error = null,
            send_attempt_count = batch_message.send_attempt_count + 1,
            sent_at = now(),
            sent_order_index = next_order.next_sent_order_index,
            updated_at = now()
          from next_order
          where batch_message.id = $1
            and batch_message.run_id = next_order.run_id
        `,
        [
          params.messageId,
          MessageSendStatus.Sent,
          params.externalMessageId,
          params.renderedSubject,
          params.renderedPlainText,
          params.renderedRichText ?? null,
        ],
      );
    },

    async markMessageTerminalFailure(messageId, sendError) {
      await pool.query(
        `
          update batch_messages
          set
            send_status = $2,
            send_error = $3,
            send_attempt_count = send_attempt_count + 1,
            updated_at = now()
          where id = $1
        `,
        [messageId, MessageSendStatus.TerminalSendFailure, sendError],
      );
    },

    async listMessagesEligibleForDeliverySync(
      runId,
      eventSyncDelaySeconds,
      now,
    ) {
      const { rows } = await pool.query<DeliverySyncCandidateRow>(
        `
          select
            id,
            external_message_id as "externalMessageId"
          from batch_messages
          where run_id = $1
            and send_status = $2
            and external_message_id is not null
            and delivery_event_at is null
            and sent_at <= ($3::timestamptz - make_interval(secs => $4))
          order by sent_order_index asc nulls last
        `,
        [
          runId,
          MessageSendStatus.Sent,
          now.toISOString(),
          eventSyncDelaySeconds,
        ],
      );

      return rows;
    },

    async countMessagesTooNewForDeliverySync(
      runId,
      eventSyncDelaySeconds,
      now,
    ) {
      const { rows } = await pool.query<CountRow>(
        `
          select count(*)::int as count
          from batch_messages
          where run_id = $1
            and send_status = $2
            and delivery_event_at is null
            and sent_at > ($3::timestamptz - make_interval(secs => $4))
        `,
        [
          runId,
          MessageSendStatus.Sent,
          now.toISOString(),
          eventSyncDelaySeconds,
        ],
      );

      return rows[0]?.count ?? 0;
    },

    async listUnresolvedRecipientReasonCounts(runId) {
      const { rows } = await pool.query<GroupedReportCountRow>(
        `
          select
            coalesce(resolution_reason, 'Unknown unresolved reason') as label,
            count(*)::int as count
          from batch_recipients
          where run_id = $1
            and resolution_status = $2
          group by coalesce(resolution_reason, 'Unknown unresolved reason')
          order by count desc, label asc
        `,
        [runId, RecipientResolutionStatus.Unresolved],
      );

      return rows;
    },

    async listTerminalSendFailureReasonCounts(runId) {
      const { rows } = await pool.query<GroupedReportCountRow>(
        `
          select
            coalesce(send_error, 'Unknown send failure') as label,
            count(*)::int as count
          from batch_messages
          where run_id = $1
            and send_status = $2
          group by coalesce(send_error, 'Unknown send failure')
          order by count desc, label asc
        `,
        [runId, MessageSendStatus.TerminalSendFailure],
      );

      return rows;
    },

    async listFailedDeliveryStatusCounts(runId) {
      const { rows } = await pool.query<GroupedReportCountRow>(
        `
          select
            coalesce(delivery_event_status, 'unknown') as label,
            count(*)::int as count
          from batch_messages
          where run_id = $1
            and successful = false
          group by coalesce(delivery_event_status, 'unknown')
          order by count desc, label asc
        `,
        [runId],
      );

      return rows;
    },

    async markDeliverySyncAttempted(messageId, attemptedAt) {
      await pool.query(
        `
          update batch_messages
          set
            last_delivery_sync_attempt_at = $2,
            updated_at = now()
          where id = $1
        `,
        [messageId, attemptedAt],
      );
    },

    async storeLatestDeliverySnapshot(params) {
      const successful = deriveDeliverySuccess(params.snapshot);

      await pool.query(
        `
          update batch_messages
          set
            delivery_event_type = case
              when delivery_event_at is null or delivery_event_at <= $5 then $2
              else delivery_event_type
            end,
            delivery_event_status = case
              when delivery_event_at is null or delivery_event_at <= $5 then $3
              else delivery_event_status
            end,
            delivery_event_payload = case
              when delivery_event_at is null or delivery_event_at <= $5 then $4
              else delivery_event_payload
            end,
            delivery_event_at = case
              when delivery_event_at is null or delivery_event_at <= $5 then $5
              else delivery_event_at
            end,
            successful = case
              when delivery_event_at is null or delivery_event_at <= $5 then $6
              else successful
            end,
            last_delivery_sync_attempt_at = $7,
            updated_at = now()
          where id = $1
        `,
        [
          params.messageId,
          params.snapshot.eventType,
          params.snapshot.eventStatus,
          params.snapshot.eventPayload,
          params.snapshot.eventAt,
          successful,
          params.syncedAt,
        ],
      );
    },

    async updateRunStatus(runId, status, latestError) {
      await pool.query(
        `
          update batch_runs
          set
            status = $2,
            latest_error = $3,
            updated_at = now()
          where id = $1
        `,
        [runId, status, latestError ?? null],
      );
    },

    async completeRun(runId, status) {
      await pool.query(
        `
          update batch_runs
          set
            status = $2,
            completed_at = now(),
            updated_at = now()
          where id = $1
        `,
        [runId, status],
      );
    },

    async getRunSummary(runId) {
      const { rows } = await pool.query<RunSummary>(
        `
          select
            run.id as "runId",
            run.status as "runStatus",
            run.run_fingerprint as "runFingerprint",
            run.organization_id as "organizationId",
            run.message_subject as "messageSubject",
            run.send_at_mode as "sendAtMode",
            run.send_at_value as "sendAtValue",
            count(distinct recipient.id)::int as "totalRecipients",
            count(distinct recipient.id) filter (where recipient.resolution_status = 'resolved')::int as "resolvedRecipients",
            count(distinct recipient.id) filter (where recipient.resolution_status = 'unresolved')::int as "unresolvedRecipients",
            count(distinct recipient.id) filter (where recipient.resolution_status = 'duplicate')::int as "duplicateRecipients",
            count(distinct message.id)::int as "totalMessages",
            count(distinct message.id) filter (where message.send_status = 'pending')::int as "pendingMessages",
            count(distinct message.id) filter (where message.send_status = 'sent')::int as "sentMessages",
            count(distinct message.id) filter (where message.send_status = 'terminal_send_failure')::int as "terminalSendFailureMessages",
            count(distinct message.id) filter (where message.delivery_event_at is not null)::int as "messagesWithSnapshot",
            count(distinct message.id) filter (where message.successful = true)::int as "successfulDeliveries",
            count(distinct message.id) filter (where message.successful = false)::int as "failedDeliveries",
            count(distinct message.id) filter (
              where message.send_status = 'sent'
                and message.delivery_event_at is null
            )::int as "awaitingSnapshots"
          from batch_runs as run
          left join batch_recipients as recipient on recipient.run_id = run.id
          left join batch_messages as message on message.run_id = run.id
          where run.id = $1
          group by run.id
        `,
        [runId],
      );

      return rows[0] ?? null;
    },

    async findLatestRunSummaryByFingerprint(runFingerprint) {
      const { rows } = await pool.query<RunIdRow>(
        `
          select id
          from batch_runs
          where run_fingerprint = $1
          order by created_at desc
          limit 1
        `,
        [runFingerprint],
      );

      if (rows[0] == null) {
        return null;
      }

      return this.getRunSummary(rows[0].id);
    },
  };
}
