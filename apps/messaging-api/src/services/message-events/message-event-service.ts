import { httpErrors } from "@fastify/sensible";
import type { Pool } from "pg";
import type {
  GetMessageEvent,
  ListMessageEventsStatus,
  MessageEventList,
} from "../../types/message-events.js";
import type { PaginationParams } from "../../types/schemaDefinitions.js";
import {
  EventKey,
  EventStatus,
  MessagingEventType,
} from "../messages/event-logger.js";

export async function listMessageEvents(params: {
  pagination: Required<PaginationParams>;
  pool: Pool;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  organizationId: string;
  status?: ListMessageEventsStatus;
  messageId?: string;
  recipientId?: string;
}): Promise<{ data: MessageEventList; totalCount: number }> {
  const {
    pool,
    pagination,
    organizationId,
    search = "",
    dateFrom,
    dateTo,
    status,
    messageId,
    recipientId,
  } = params;

  let eventsStatusFilter = "";
  switch (status) {
    case "delivered":
      eventsStatusFilter = `
        AND mes.event_status='${EventStatus.SUCCESSFUL}' 
        AND mes.event_type = ANY(ARRAY['${EventKey.EMAIL_DELIVERY}','${EventKey.MESSAGE_DELIVERY}'])
      `;
      break;
    case "failed":
      eventsStatusFilter = `AND mes.event_status='${EventStatus.FAILED}'`;
      break;
    case "opened":
      eventsStatusFilter = `
        AND mes.event_status='${MessagingEventType.citizenSeenMessage.status}'
        AND mes.event_type = '${MessagingEventType.citizenSeenMessage.key}'
      `;
      break;
    case "scheduled":
      eventsStatusFilter = `
        AND mes.event_status='${MessagingEventType.scheduleMessage.status}' 
        AND mes.event_type = '${MessagingEventType.scheduleMessage.key}'
      `;
      break;
    default:
      break;
  }

  const countValues = [organizationId, `%${search}%`, dateFrom, dateTo];
  let messageIdFilter = "";
  if (messageId && messageId.length > 0) {
    countValues.push(messageId);
    messageIdFilter = "AND mes.message_id = $5";
  }

  let recipientFilter = "";
  if (recipientId && recipientId.length > 0) {
    countValues.push(recipientId);
    recipientFilter = `
      AND mes.data->>'receiverUserId' = $${countValues.length}
    `;
  }

  // Separate count query first
  const countQuery = await pool.query<{ count: number }>(
    `
    SELECT COUNT(DISTINCT mes.message_id) as "count"
    FROM message_event_summary mes
    WHERE mes.organisation_id = $1 ${messageIdFilter} ${recipientFilter}
        ${eventsStatusFilter}
      AND (
        mes.subject ILIKE $2
        OR mes.data->>'receiverFullName' ILIKE $2
        OR mes.data->>'receiverPPSN' ILIKE $2
      )
      AND mes.scheduled_at::DATE BETWEEN 
        COALESCE($3::DATE, (NOW() AT TIME ZONE 'UTC')::DATE - INTERVAL '30 days')
        AND COALESCE($4::DATE, (NOW() AT TIME ZONE 'UTC')::DATE)
    `,
    countValues,
  );

  const totalCount = Number(countQuery.rows[0]?.count) || 0;
  if (totalCount === 0) {
    return { data: [], totalCount: 0 };
  }
  const dataValues = [
    organizationId,
    `%${search}%`,
    dateFrom,
    dateTo,
    `${pagination.limit}`,
    `${pagination.offset}`,
  ];
  if (messageId && messageId.length > 0) {
    messageIdFilter = "AND mes.message_id = $7";
    dataValues.push(messageId);
  }

  if (recipientId && recipientId.length > 0) {
    dataValues.push(recipientId);
    recipientFilter = `
      AND mes.data->>'receiverUserId' = $${dataValues.length}
    `;
  }

  const result = await pool.query<{
    id: string;
    messageId: string;
    subject: string;
    receiverFullName: string;
    eventStatus: string;
    eventType: string;
    scheduledAt: Date;
  }>(
    `
  SELECT
    mes.messaging_event_logs_id AS "id",
    mes.message_id AS "messageId",
    mes.subject,
    mes.event_status AS "eventStatus",
    mes.event_type AS "eventType",
    COALESCE(
      mes.data->>'receiverFullName',
      NULL
    ) AS "receiverFullName",
    mes.scheduled_at AS "scheduledAt"
  FROM message_event_summary mes
  WHERE mes.organisation_id = $1
    ${messageIdFilter ?? ""}
    ${recipientFilter ?? ""}
    AND (
      mes.subject ILIKE $2
      OR mes.data->>'receiverFullName' ILIKE $2
      OR mes.data->>'receiverPPSN' ILIKE $2
    )
    AND mes.scheduled_at::DATE BETWEEN 
        COALESCE($3::DATE, (NOW() AT TIME ZONE 'UTC')::DATE - INTERVAL '30 days')
        AND COALESCE($4::DATE, (NOW() AT TIME ZONE 'UTC')::DATE)
    ${eventsStatusFilter ?? ""}
  ORDER BY mes.updated_at DESC, mes.message_id
  LIMIT $5
  OFFSET $6
  `,
    dataValues,
  );

  return {
    data: result.rows.map((row) => ({
      id: row.id,
      messageId: row.messageId,
      subject: row.subject,
      receiverFullName: row.receiverFullName,
      eventStatus: row.eventStatus,
      eventType: row.eventType,
      scheduledAt: row.scheduledAt.toISOString(),
    })),
    totalCount,
  };
}

export async function getMessageEvent(params: {
  eventId: string;
  organizationId: string;
  pool: Pool;
}): Promise<GetMessageEvent[]> {
  const { eventId, organizationId, pool } = params;
  const queryResult = await pool.query<GetMessageEvent>(
    `
      with message_id_cte as (
          select mel.message_id
          from messaging_event_logs mel
          join messages m on m.id = mel.message_id
          where mel.id = $1 
            and m.organisation_id = $2
      )
      select
          mel.event_status as "eventStatus",
          mel.event_type as "eventType",
          mel.data,
          mel.created_at as "createdAt",
          mel.message_id as "messageId"
      from messaging_event_logs as mel
      where mel.message_id = (select message_id from message_id_cte)
      order by
          mel.created_at desc
        `,
    [eventId, organizationId],
  );

  if (!queryResult.rows.length) {
    throw httpErrors.notFound("No message event found for the organization");
  }

  return queryResult.rows;
}

export async function getEventsForMessageId(params: {
  messageId: string;
  organizationId: string;
  pool: Pool;
}): Promise<GetMessageEvent[]> {
  const { messageId, organizationId, pool } = params;
  const queryResult = await pool.query<GetMessageEvent>(
    `
      with message_id_cte as (
          select mel.message_id
          from messaging_event_logs mel
          join messages m on m.id = mel.message_id
          where mel.message_id = $1 
            and m.organisation_id = $2
          limit 1
      )
      select
          mel.event_status as "eventStatus",
          mel.event_type as "eventType",
          mel.data,
          mel.created_at as "createdAt",
          mel.message_id as "messageId"
      from messaging_event_logs as mel
      where mel.message_id = (select message_id from message_id_cte)
      order by
          mel.created_at desc
        `,
    [messageId, organizationId],
  );

  if (!queryResult.rows.length) {
    throw httpErrors.notFound("No message event found for the organization");
  }

  return queryResult.rows;
}
