import { httpErrors } from "@fastify/sensible";
import type { FastifyBaseLogger } from "fastify";
import type { Pool, PoolClient } from "pg";
import type {
  SupportBodyParams,
  SupportMessageItem,
  SupportMessageList,
} from "../../types/messages-support.js";
import type { PaginationParams } from "../../types/schemaDefinitions.js";

export async function supportListMessages(params: {
  pagination: Required<PaginationParams>;
  requestParams: SupportBodyParams;
  logger: FastifyBaseLogger;
  pool: Pool;
  deletedAfterDateTime?: string;
}): Promise<{ data: SupportMessageList; totalCount: number }> {
  const { pagination, requestParams, logger, pool, deletedAfterDateTime } =
    params;

  const client = await pool.connect();
  try {
    return queryMessagesForList({
      client,
      recipientUserIds: requestParams.recipientUserIds,
      pagination,
      deletedAfterDateTime,
    });
  } catch (error) {
    logger.error({ error }, "Error retrieving messages for support list");
    throw httpErrors.createError(
      500,
      "Failed retrieving messages for support list",
      {
        parent: error,
      },
    );
  } finally {
    client.release();
  }
}

async function queryMessagesForList(params: {
  client: PoolClient;
  recipientUserIds: string[];
  pagination: Required<PaginationParams>;
  deletedAfterDateTime?: string;
}): Promise<{ data: SupportMessageList; totalCount: number }> {
  const { client, recipientUserIds, pagination, deletedAfterDateTime } = params;

  const hasDeletedAfter =
    deletedAfterDateTime !== undefined && Date.parse(deletedAfterDateTime);

  const deletedAtClause = hasDeletedAfter
    ? "AND m.deleted_at >= $4"
    : "AND m.deleted_at IS NULL";
  const deletedAtClauseNoAlias = hasDeletedAfter
    ? "AND deleted_at >= $2"
    : "AND deleted_at IS NULL";

  const selectDataQuery = `
    SELECT
      m.id,
      m.organisation_id AS "organisationId",
      m.user_id AS "recipientUserId",
      m.thread_name AS "threadName",
      m.is_seen AS "isSeen",
      m.subject AS "subject",
      m.rich_text AS "richText",
      m.plain_text AS "plainText",
      m.created_at AS "createdAt",
      m.scheduled_at AS "scheduledAt",
      json_agg(am.attachment_id) FILTER (WHERE am.attachment_id IS NOT NULL) AS "attachmentIds"
    FROM messages m
    LEFT JOIN attachments_messages am
      ON m.id = am.message_id
    WHERE m.user_id = ANY ($1::text[])
      AND m.scheduled_at <= now()
      ${deletedAtClause}
    GROUP BY m.id
    ORDER BY m.user_id, m.created_at DESC
    LIMIT $2
    OFFSET $3;
    `;
  const selectCountQuery = `
    SELECT COUNT(*) as count
    FROM messages 
    WHERE user_id = ANY ($1)
    AND scheduled_at <= now()
    ${deletedAtClauseNoAlias};
  `;

  const countQueryParams: (string | string[])[] = [recipientUserIds];
  if (hasDeletedAfter) {
    countQueryParams.push(deletedAfterDateTime);
  }

  const countQueryResult = await client.query<{ count: string }>(
    selectCountQuery,
    countQueryParams,
  );

  if (countQueryResult.rowCount === 0) {
    throw new Error("Count query did not return any rows");
  }
  const totalCount = Number(countQueryResult.rows[0].count);

  if (totalCount === 0) {
    return { data: [], totalCount: 0 };
  }

  const dataQueryParams: (string | string[] | number)[] = [
    recipientUserIds,
    pagination.limit,
    pagination.offset,
  ];
  if (hasDeletedAfter) {
    dataQueryParams.push(deletedAfterDateTime);
  }

  const dataQueryResult = await client.query<SupportMessageItem>(
    selectDataQuery,
    dataQueryParams,
  );

  return { data: dataQueryResult.rows, totalCount };
}
