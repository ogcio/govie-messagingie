import type { FastifyInstance } from "fastify";
import { processMessage } from "../../services/messages/message-service.js";
import { supportListMessages } from "../../services/messages/support-service.js";
import {
  type CreateMessageBody,
  CreateMessageReqSchema,
  type GenericIdResponse,
} from "../../types/messages.js";
import {
  type SupportBodyParams,
  type SupportListMessageResponse,
  SupportListMessagesRequestSchema,
  type SupportQueryParams,
} from "../../types/messages-support.js";
import { Permissions } from "../../types/permissions.js";
import { parseBooleanEnum } from "../../types/schemaDefinitions.js";
import {
  formatAPIResponse,
  sanitizePagination,
} from "../../utils/pagination.js";

export const supportMessagesPrefix = "/support/messages";

export default async function supportMessages(app: FastifyInstance) {
  app.post<{
    Body: SupportBodyParams;
    Response: SupportListMessageResponse;
    Querystring: SupportQueryParams;
  }>(
    "/search",
    {
      preValidation: (req, res) =>
        app.checkPermissions(req, res, [Permissions.Platform.Read]),
      schema: SupportListMessagesRequestSchema,
    },
    async function postMessagesHandler(request, reply) {
      if (!request.userData) {
        return reply.status(401).send({ message: "User must be logged in" });
      }

      if (request.userData.organizationId) {
        return reply
          .status(403)
          .send({ message: "User must not be part of an organisation" });
      }

      if (!request.userData.isM2MApplication) {
        return reply.status(403).send({
          message:
            "This endpoint is only accessible by system-to-system applications",
        });
      }

      const pagination = sanitizePagination({
        limit: request.query.limit,
        offset: request.query.offset,
      });

      const messages = await supportListMessages({
        requestParams: request.body,
        pagination,
        pool: app.pg.pool,
        logger: request.log,
        deleted:
          request.query.deleted !== undefined
            ? parseBooleanEnum(request.query.deleted)
            : undefined,
      });

      return formatAPIResponse({
        data: messages.data,
        request,
        totalCount: messages.totalCount,
      });
    },
  );

  app.post<{ Body: CreateMessageBody; Response: GenericIdResponse }>(
    "/",
    {
      preValidation: (req, res) =>
        app.checkPermissions(req, res, [Permissions.Platform.Write]),
      schema: {
        ...CreateMessageReqSchema,
        operationId: "SupportCreateMessage",
      },
    },
    async function createMessageHandler(request, reply) {
      if (!request.userData) {
        return reply.status(401).send({ message: "User must be logged in" });
      }

      if (!request.userData.isM2MApplication) {
        return reply.status(403).send({
          message:
            "This endpoint is only accessible by system-to-system applications",
        });
      }

      const senderUser = {
        id: request.userData.userId,
        organizationId: app.config.SUPPORT_ORGANISATION_ID,
        isM2MApplication: true,
      };

      const message = await processMessage({
        pool: app.pg.pool,
        logger: request.log,
        message: request.body,
        sender: senderUser,
      });

      reply.statusCode = 201;
      return { data: { id: message.messageId } };
    },
  );
}
