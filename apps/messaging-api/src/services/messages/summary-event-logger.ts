import type { Pool } from "pg";
import type { GetMessageEvent } from "../../types/message-events.js";

type MessageEventSummary = {
  id?: string;
  messagingEventLogsId: string;
  messageId: string;
  organisationId: string;
  subject: string;
  eventStatus: string;
  eventType: string;
  data: Record<string, number | null | string | string[] | undefined>;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function syncSummaryForMessage(params: {
  messageId: string;
  pool: Pool;
}): Promise<void> {
  const messageSummary = await getMessageSummary(params);

  await updateSummaryForMessage({ ...params, fromDbSummary: messageSummary });
}

async function getMessageSummary(params: {
  messageId: string;
  pool: Pool;
}): Promise<MessageEventSummary | null> {
  const messageSummaryList = await params.pool.query<MessageEventSummary>(
    `
    SELECT
        id,
        messaging_event_logs_id AS "messagingEventLogsId",
        message_id AS "messageId",
        organisation_id AS "organisationId",
        subject,
        event_status AS "eventStatus",
        event_type AS "eventType",
        data,
        scheduled_at AS "scheduledAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    FROM message_event_summary
    WHERE message_id = $1;
    `,
    [params.messageId],
  );

  if (messageSummaryList.rowCount === 0) {
    return null;
  }
  return messageSummaryList.rows[0];
}

async function updateSummaryForMessage(params: {
  messageId: string;
  pool: Pool;
  fromDbSummary: MessageEventSummary | null;
}): Promise<void> {
  const queryValues = [params.messageId];
  let updatedAtClause = "";
  if (params.fromDbSummary) {
    queryValues.push(params.fromDbSummary.updatedAt);
    updatedAtClause = " AND created_at > $2";
  }

  const sortedEventsPerMessage = await params.pool.query<
    GetMessageEvent & { id: string }
  >(
    `
    SELECT 
        id,
        message_id AS "messageId",
        event_status AS "eventStatus",
        event_type AS "eventType",
        data,
        created_at AS "createdAt"
    FROM messaging_event_logs
    WHERE message_id = $1 ${updatedAtClause}
    ORDER BY created_at ASC;
    `,
    queryValues,
  );

  if (sortedEventsPerMessage.rowCount === 0) {
    return;
  }

  const summaryToInsert = await fillEventSummary({
    ...params,
    sortedEventsPerMessage: sortedEventsPerMessage.rows,
  });

  await params.pool.query(
    `
    INSERT INTO message_event_summary (
        messaging_event_logs_id,
        message_id,
        organisation_id,
        subject,
        event_status,
        event_type,
        data,
        scheduled_at,
        created_at,
        updated_at
    ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
    )
    ON CONFLICT (message_id) DO UPDATE SET
        messaging_event_logs_id = EXCLUDED.messaging_event_logs_id,
        message_id = EXCLUDED.message_id,
        organisation_id = EXCLUDED.organisation_id,
        subject = EXCLUDED.subject,
        event_status = EXCLUDED.event_status,
        event_type = EXCLUDED.event_type,
        data = EXCLUDED.data,
        scheduled_at = EXCLUDED.scheduled_at,
        updated_at = EXCLUDED.updated_at;
    `,
    [
      summaryToInsert.messagingEventLogsId,
      summaryToInsert.messageId,
      summaryToInsert.organisationId,
      summaryToInsert.subject,
      summaryToInsert.eventStatus,
      summaryToInsert.eventType,
      summaryToInsert.data,
      summaryToInsert.scheduledAt,
      summaryToInsert.createdAt,
      summaryToInsert.updatedAt,
    ],
  );
}

async function fillEventSummary(params: {
  messageId: string;
  pool: Pool;
  fromDbSummary: MessageEventSummary | null;
  sortedEventsPerMessage: (GetMessageEvent & { id: string })[];
}): Promise<MessageEventSummary> {
  let summaryToInsert = params.fromDbSummary;
  let firstEventToGetIndex = 0;

  if (summaryToInsert === null) {
    const firstEvent = params.sortedEventsPerMessage[firstEventToGetIndex++];
    const messageInfo = await getMessageInfo(params);
    summaryToInsert = {
      messagingEventLogsId: firstEvent.id,
      messageId: params.messageId,
      organisationId: messageInfo.organisationId,
      subject: messageInfo.subject,
      eventStatus: firstEvent.eventStatus,
      eventType: firstEvent.eventType,
      data: firstEvent.data,
      scheduledAt: messageInfo.scheduledAt,
      createdAt: firstEvent.createdAt,
      updatedAt: firstEvent.createdAt,
    };
  }
  // ignore first event if needed, we already processed it
  for (
    let i = firstEventToGetIndex;
    i < params.sortedEventsPerMessage.length;
    i++
  ) {
    const currentEvent = params.sortedEventsPerMessage[i];
    summaryToInsert.eventStatus = currentEvent.eventStatus;
    summaryToInsert.eventType = currentEvent.eventType;
    // we merge the data
    summaryToInsert.data = { ...summaryToInsert.data, ...currentEvent.data };
    summaryToInsert.updatedAt = currentEvent.createdAt;
    summaryToInsert.messagingEventLogsId = currentEvent.id;
  }

  return summaryToInsert;
}

async function getMessageInfo(params: {
  messageId: string;
  pool: Pool;
}): Promise<{
  subject: string;
  organisationId: string;
  scheduledAt: string | null;
}> {
  const messages = await params.pool.query<{
    subject: string;
    organisationId: string;
    scheduledAt: string | null;
  }>(
    `
    SELECT 
        subject as "subject",
        organisation_id as "organisationId",
        scheduled_at as "scheduledAt"
    FROM messages
    WHERE id = $1
    `,
    [params.messageId],
  );

  return messages.rows[0];
}
