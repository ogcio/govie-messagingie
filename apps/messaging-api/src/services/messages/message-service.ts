import { httpErrors } from "@fastify/sensible";
import { getErrorMessage } from "@ogcio/shared-errors";
import type { FastifyBaseLogger } from "fastify";
import { isHttpError } from "http-errors";
import type { Pool, PoolClient, QueryResult } from "pg";
import { type Static, Type } from "typebox";
import {
  type CreateMessageBody,
  type Delivered,
  type MessageList,
  MessageListItemSchema,
  type PartialReadMessage,
  type ReadMessage,
} from "../../types/messages.js";
import type {
  AcceptedQueryBooleanValues,
  PaginationParams,
} from "../../types/schemaDefinitions.js";
import { messagesCreatedCounter } from "../../utils/metrics.js";
import { ProfilePersonalSdkWrapper } from "../users/profile-personal-sdk-wrapper.js";
import { MessagesProcessor } from "./messages-processor.js";

const MessageListItemWithCount = Type.Evaluate(
  Type.Intersect([
    MessageListItemSchema,
    Type.Object({ count: Type.Number() }),
  ]),
);

type QueryRow = Static<typeof MessageListItemWithCount>;

export async function listMessages(params: {
  loggedInUserData: {
    organizationId: string | undefined;
    userId: string;
    accessToken: string;
  };
  query: {
    recipientUserId: string | undefined;
    organisationId: string | undefined;
    messagesStatus: Delivered | undefined;
    isSeen: AcceptedQueryBooleanValues | undefined;
    search: string | undefined;
    deleted: boolean | undefined;
  };
  pool: Pool;
  pagination: Required<PaginationParams>;
  logger: FastifyBaseLogger;
}): Promise<{ data: MessageList; totalCount: number }> {
  const { loggedInUserData, query, pool, pagination, logger } = params;

  const requestedIds = await getRequestedIds(loggedInUserData, query, logger);

  return queryMessagesForList({
    pool,
    recipientUserIds: requestedIds.userIds,
    organizationId: requestedIds.organizationId,
    query,
    pagination,
  });
}

export async function getMessage(params: {
  pool: Pool;
  userId?: string;
  messageId: string;
  loggedInUser: { userId: string; accessToken: string };
  hasOnboardingPermission: boolean;
  logger: FastifyBaseLogger;
  deleted?: boolean;
}): Promise<ReadMessage | PartialReadMessage> {
  const args: string[] = [params.messageId];
  let userIdClause = "";
  if (params.userId) {
    args.push(params.userId);
    userIdClause = "AND messages.user_id = $2";
  }

  const deletedAtClause =
    params.deleted === true
      ? "AND messages.deleted_at IS NOT NULL"
      : "AND messages.deleted_at IS NULL";

  const data = await params.pool.query<ReadMessage>(
    `   
    SELECT 
        messages.subject as "subject", 
        messages.excerpt as "excerpt", 
        messages.plain_text as "plainText",
        messages.rich_text as "richText",
        messages.created_at as "createdAt",
        messages.thread_name as "threadName",
        messages.organisation_id as "organisationId",
        messages.user_id as "recipientUserId",
        messages.is_seen as "isSeen",
        messages.security_level as "security",
        messages.external_id as "externalId",
        COALESCE(ARRAY_AGG(attachments_messages.attachment_id) FILTER (WHERE attachments_messages.attachment_id IS NOT NULL), '{}') AS "attachments"
    FROM messages
    LEFT JOIN attachments_messages 
        ON attachments_messages.message_id = messages.id
    WHERE 
        messages.id = $1
        AND messages.scheduled_at <= now()
        ${deletedAtClause}
        ${userIdClause}
    GROUP BY 
        messages.subject, 
        messages.excerpt, 
        messages.plain_text, 
        messages.rich_text, 
        messages.created_at, 
        messages.thread_name, 
        messages.organisation_id, 
        messages.user_id, 
        messages.is_seen, 
        messages.security_level,
        messages.external_id
    ORDER BY messages.created_at DESC;
    `,
    args,
  );

  if (data.rowCount === 0) {
    const errorMessage = params.userId
      ? `No message with id ${params.messageId} for the logged in user does exist`
      : `No message with id ${params.messageId} exist`;
    throw httpErrors.notFound(errorMessage);
  }
  const message = data.rows[0];
  params.logger.debug(
    {
      messageId: `${params.messageId.substring(0, 5)}...`,
      recipientId: `${message.recipientUserId.substring(0, 4)}...`,
      isRecipientIdEqualToLoggedIn:
        message.recipientUserId === params.loggedInUser.userId,
    },
    "Retrieved message",
  );
  return prepareGetMessageResponse({ ...params, message: data.rows[0] });
}

export async function processMessage(params: {
  pool: Pool;
  sender: {
    id: string;
    organizationId: string;
    isM2MApplication: boolean;
  };
  message: CreateMessageBody;
  logger: FastifyBaseLogger;
}) {
  const messagesProcessor = new MessagesProcessor(params.pool, params.logger);

  const result = await messagesProcessor.processMessage({
    message: params.message,
    senderUser: params.sender,
  });

  messagesCreatedCounter.add(1, {
    organizationId: params.sender.organizationId,
  });

  return result;
}

async function getRequestedIds(
  loggedInUserData: {
    organizationId: string | undefined;
    userId: string;
    accessToken: string;
  },
  query: {
    recipientUserId: string | undefined;
    organisationId: string | undefined;
  },
  logger: FastifyBaseLogger,
): Promise<{ userIds: string[]; organizationId: string | undefined }> {
  if (loggedInUserData.organizationId) {
    throw httpErrors.forbidden("Public servant can't access messages");
  }
  // if the citizen is asking specifically for its own data,
  // without linked ids, then return only its own data
  if (loggedInUserData.userId === query.recipientUserId) {
    return {
      userIds: [query.recipientUserId],
      organizationId: query.organisationId,
    };
  }

  const linkedProfilesIds = await getLinkedProfiles({
    userData: loggedInUserData,
    logger,
  });

  const userIds = [loggedInUserData.userId, ...linkedProfilesIds];

  if (!query.recipientUserId) {
    return { userIds, organizationId: query.organisationId };
  }

  if (userIds.includes(query.recipientUserId)) {
    return {
      userIds: [query.recipientUserId],
      organizationId: query.organisationId,
    };
  }

  throw httpErrors.forbidden(
    "Not allowed to see messages for the requested user",
  );
}

async function queryMessagesForList(params: {
  pool: Pool;
  recipientUserIds: string[];
  organizationId: string | undefined;
  pagination: Required<PaginationParams>;
  query: {
    isSeen: AcceptedQueryBooleanValues | undefined;
    search: string | undefined;
    deleted: boolean | undefined;
  };
}): Promise<{ data: MessageList; totalCount: number }> {
  const { pool, recipientUserIds, organizationId, pagination, query } = params;

  // Build WHERE clauses and params dynamically so PostgreSQL
  // can pick the optimal index for each combination.
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (organizationId) {
    conditions.push(`organisation_id = $${paramIndex}`);
    values.push(organizationId);
    paramIndex++;
  }

  conditions.push(`user_id = ANY ($${paramIndex})`);
  values.push(recipientUserIds);
  paramIndex++;

  conditions.push(`scheduled_at <= now()`);

  if (query.deleted === true) {
    conditions.push(`deleted_at IS NOT NULL`);
  } else {
    conditions.push(`deleted_at IS NULL`);
  }

  if (query.isSeen !== undefined) {
    conditions.push(`messages.is_seen = $${paramIndex}::boolean`);
    values.push(query.isSeen);
    paramIndex++;
  }

  conditions.push(`subject ilike $${paramIndex}`);
  values.push(query.search ? `%${query.search}%` : "%%");
  paramIndex++;

  const limitParam = paramIndex++;
  const offsetParam = paramIndex++;
  values.push(pagination.limit, pagination.offset);

  const whereClause = conditions.join("\n              AND ");

  let messagesQueryResult: QueryResult<QueryRow> | undefined;
  try {
    messagesQueryResult = await pool.query<QueryRow>(
      `
          SELECT
              messages.id,
              messages.subject,
              messages.thread_name AS "threadName",
              messages.organisation_id AS "organisationId",
              messages.user_id AS "recipientUserId",
              messages.scheduled_at AS "createdAt",
              COUNT(*) OVER() AS "count",
              (SELECT COUNT(*) FROM attachments_messages WHERE attachments_messages.message_id = messages.id) AS "attachmentsCount"
          FROM messages
          WHERE
              ${whereClause}
          ORDER BY messages.scheduled_at DESC
          LIMIT $${limitParam}
          OFFSET $${offsetParam};
        `,
      values,
    );
  } catch (error) {
    throw httpErrors.createError(500, "failed to query organisation messages", {
      parent: error,
    });
  }

  const totalCount = messagesQueryResult.rows.at(0)?.count
    ? Number(messagesQueryResult.rows.at(0)?.count)
    : undefined;

  if (!totalCount) {
    return { data: [], totalCount: 0 };
  }

  // removing count field from output
  const output = messagesQueryResult.rows.map(
    ({ count, ...otherFields }) => otherFields,
  );

  return { data: output, totalCount };
}

async function prepareGetMessageResponse({
  loggedInUser,
  hasOnboardingPermission,
  message,
  messageId,
  logger,
}: {
  loggedInUser: { userId: string; accessToken: string };
  hasOnboardingPermission: boolean;
  message: ReadMessage;
  messageId: string;
  logger: FastifyBaseLogger;
}): Promise<ReadMessage | PartialReadMessage> {
  if (loggedInUser.userId === message.recipientUserId) {
    logger.debug("Logged user id is the same as the recipient");
    return message;
  }

  if (hasOnboardingPermission) {
    logger.debug(
      "Logged user has onboarding permissions, returning partial info",
    );
    return {
      recipientUserId: message.recipientUserId,
      organisationId: message.organisationId,
    };
  }

  const linkedProfilesIds = await getLinkedProfiles({
    userData: { ...loggedInUser, organizationId: undefined },
    logger,
  });

  if (linkedProfilesIds.includes(message.recipientUserId)) {
    logger.debug(
      "Recipient user is linked to logged in user, returning the message",
    );
    return message;
  }

  throw httpErrors.notFound(
    `No message with id ${messageId} for the logged in user does exist`,
  );
}

async function getLinkedProfiles(params: {
  userData: {
    organizationId: string | undefined;
    userId: string;
    accessToken: string;
  };
  logger: FastifyBaseLogger;
}): Promise<string[]> {
  const profileSdk = new ProfilePersonalSdkWrapper(
    params.logger,
    params.userData,
  );
  const linkedProfilesIds = await profileSdk.getLinkedProfileIds(
    params.userData.userId,
  );

  return linkedProfilesIds;
}

async function fetchAndValidateMessages(
  client: PoolClient,
  uniqueMessageIds: string[],
  logger: FastifyBaseLogger,
): Promise<
  { id: string; deletedAt: string | null; recipientUserId: string }[]
> {
  const result = await client.query<{
    id: string;
    deletedAt: string | null;
    recipientUserId: string;
  }>(
    `
      SELECT id, deleted_at AS "deletedAt", user_id AS "recipientUserId"
      FROM messages
      WHERE id = ANY($1)
    `,
    [uniqueMessageIds],
  );

  if (result.rows.length !== uniqueMessageIds.length) {
    const notFoundIds = uniqueMessageIds.filter(
      (id) => !result.rows.some((message) => message.id === id),
    );
    logger.warn(
      { notFoundIds },
      "One or more messages not found during delete operation",
    );
    throw httpErrors.notFound("One or more messages not found");
  }

  return result.rows;
}

function groupMessagesByStatus(
  messages: { id: string; deletedAt: string | null; recipientUserId: string }[],
  logger: FastifyBaseLogger,
): Record<string, string[]> {
  const alreadyDeleted: string[] = [];
  const byRecipientId: Record<string, string[]> = {};

  for (const message of messages) {
    if (message.deletedAt) {
      alreadyDeleted.push(message.id);
    } else {
      if (!byRecipientId[message.recipientUserId]) {
        byRecipientId[message.recipientUserId] = [];
      }
      byRecipientId[message.recipientUserId].push(message.id);
    }
  }

  if (alreadyDeleted.length > 0) {
    logger.warn(
      { alreadyDeletedIds: alreadyDeleted },
      "One or more messages already deleted during delete operation",
    );
    throw httpErrors.notFound("One or more messages not found");
  }

  return byRecipientId;
}

async function validateDeletePermissions(params: {
  byRecipientId: Record<string, string[]>;
  loggedInUser: { userId: string; accessToken: string };
  logger: FastifyBaseLogger;
}): Promise<void> {
  const { byRecipientId, loggedInUser, logger } = params;
  const recipientIds = Object.keys(byRecipientId);

  const hasOtherRecipients = recipientIds.some(
    (id) => id !== loggedInUser.userId,
  );

  let validUserIds = [loggedInUser.userId];
  if (hasOtherRecipients) {
    const linkedProfiles = await getLinkedProfiles({
      userData: {
        organizationId: undefined,
        userId: loggedInUser.userId,
        accessToken: loggedInUser.accessToken,
      },
      logger,
    });
    validUserIds = Array.from(
      new Set([loggedInUser.userId, ...linkedProfiles]),
    );
  }

  const invalidRecipientIds = recipientIds.filter(
    (recipientId) => !validUserIds.includes(recipientId),
  );
  if (invalidRecipientIds.length > 0) {
    logger.warn(
      { invalidRecipientIds },
      "User attempted to delete messages for recipient ids they don't have access to",
    );
    throw httpErrors.forbidden("Not allowed to delete one or more messages");
  }
}

async function executeSoftDelete(
  client: PoolClient,
  uniqueMessageIds: string[],
  logger: FastifyBaseLogger,
): Promise<void> {
  try {
    await client.query("BEGIN");
    await client.query(
      `
      UPDATE messages
      SET deleted_at = now(), updated_at = now()
      WHERE id = ANY($1)
    `,
      [uniqueMessageIds],
    );
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      logger.error(
        { error: getErrorMessage(rollbackError) },
        "Failed to rollback transaction after error in deleteMessages",
      );
    }
    throw error;
  }
}

export async function deleteMessages(params: {
  pool: Pool;
  messageIds: string[];
  logger: FastifyBaseLogger;
  loggedInUser: { userId: string; accessToken: string };
}) {
  const { pool, messageIds, logger, loggedInUser } = params;
  const uniqueMessageIds = Array.from(new Set(messageIds));
  const client = await pool.connect();
  try {
    const messages = await fetchAndValidateMessages(
      client,
      uniqueMessageIds,
      logger,
    );

    const byRecipientId = groupMessagesByStatus(messages, logger);

    await validateDeletePermissions({
      byRecipientId,
      loggedInUser,
      logger,
    });

    await executeSoftDelete(client, uniqueMessageIds, logger);
  } catch (error) {
    if (isHttpError(error)) {
      throw error;
    }
    throw httpErrors.internalServerError(
      "An unexpected error occurred while deleting messages",
    );
  } finally {
    client.release();
  }
}
