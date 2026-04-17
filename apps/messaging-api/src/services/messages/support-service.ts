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
  deleted?: boolean;
}): Promise<{ data: SupportMessageList; totalCount: number }> {
  const { pagination, requestParams, logger, pool, deleted } = params;

  const client = await pool.connect();
  try {
    return queryMessagesForList({
      client,
      recipientUserIds: requestParams.recipientUserIds,
      pagination,
      deleted,
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
  deleted?: boolean;
}): Promise<{ data: SupportMessageList; totalCount: number }> {
  const { client, recipientUserIds, pagination, deleted } = params;

  const deletedAtClause =
    deleted === true
      ? "AND m.deleted_at IS NOT NULL"
      : "AND m.deleted_at IS NULL";

  const deletedAtClauseNoAlias =
    deleted === true ? "AND deleted_at IS NOT NULL" : "AND deleted_at IS NULL";

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

  const countQueryResult = await client.query<{ count: string }>(
    selectCountQuery,
    [recipientUserIds],
  );

  if (countQueryResult.rowCount === 0) {
    throw new Error("Count query did not return any rows");
  }
  const totalCount = Number(countQueryResult.rows[0].count);

  if (totalCount === 0) {
    return { data: [], totalCount: 0 };
  }

  const dataQueryResult = await client.query<SupportMessageItem>(
    selectDataQuery,
    [recipientUserIds, pagination.limit, pagination.offset],
  );

  return { data: dataQueryResult.rows, totalCount };
}
