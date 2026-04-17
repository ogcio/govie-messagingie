import { httpErrors } from "@fastify/sensible";
import { ensureUserCanAccessUser } from "@ogcio/api-auth";
import type { FastifyInstance } from "fastify";
import { getEventsForMessageId } from "../../services/message-events/message-event-service.js";
import {
  deleteMessages,
  getMessage,
  listMessages,
  processMessage,
} from "../../services/messages/message-service.js";
import {
  type CreateMessageBody,
  CreateMessageReqSchema,
  DeleteMessagesReqSchema,
  type GenericIdResponse,
  GetEventsForMessageReqSchema,
  type GetMessageParams,
  type GetMessageQuerystring,
  GetMessageReqSchema,
  type GetMessageResponse,
  type ListMessageResponse,
  ListMessagesReqGetSchema,
  type ListMessagesReqParams,
  ListMessagesReqPostSchema,
} from "../../types/messages.js";
import { Permissions } from "../../types/permissions.js";
import { parseBooleanEnum } from "../../types/schemaDefinitions.js";
import type {
  FastifyReplyTypebox,
  FastifyRequestTypebox,
} from "../../types/shared.js";
import {
  ensureOrganizationIdIsSet,
  ensureUserIdIsSet,
  getM2MAnalyticsSdk,
} from "../../utils/authentication-factory.js";
import { hasPermission } from "../../utils/has-permission.js";
import {
  formatAPIResponse,
  sanitizePagination,
} from "../../utils/pagination.js";

export const prefix = "/messages";

export default async function messages(app: FastifyInstance) {
  // All messages
  app.get<{
    Response: ListMessageResponse;
    Querystring: ListMessagesReqParams;
  }>(
    "/",
    {
      preValidation: async (req, res) =>
        app.checkPermissions(
          req,
          res,
          [Permissions.MessageSelf.Read, Permissions.OnboardedCitizen],
          { method: "AND" },
        ),
      schema: ListMessagesReqGetSchema,
    },
    async function getMessagesHandler(request, _reply) {
      if (!request.userData) {
        throw httpErrors.unauthorized("User needs to be logged in");
      }
      const loggedInUserId = request.userData.userId;
      const loggedInOrgId = request.userData.organizationId;
      const queryRecipientUserId = request.query.recipientUserId;
      const queryOrganisationId = request.query.organisationId;
      const pagination = sanitizePagination({
        limit: request.query.limit,
        offset: request.query.offset,
      });

      const messages = await listMessages({
        loggedInUserData: {
          userId: loggedInUserId,
          organizationId: loggedInOrgId,
          accessToken: request.userData.accessToken,
        },
        query: {
          recipientUserId: queryRecipientUserId,
          organisationId: queryOrganisationId,
          isSeen: request.query.isSeen,
          search: request.query.search,
          messagesStatus: request.query.status,
          deleted:
            request.query.deleted !== undefined
              ? parseBooleanEnum(request.query.deleted)
              : undefined,
        },
        pagination,
        pool: app.pg.pool,
        logger: request.log,
      });

      return formatAPIResponse({
        data: messages.data,
        request,
        totalCount: messages.totalCount,
      });
    },
  );

  app.post<{
    Body: ListMessagesReqParams;
    Response: ListMessageResponse;
  }>(
    "/search",
    {
      preValidation: (req, res) =>
        app.checkPermissions(
          req,
          res,
          [Permissions.MessageSelf.Read, Permissions.OnboardedCitizen],
          { method: "AND" },
        ),
      schema: ListMessagesReqPostSchema,
    },
    async function postMessagesHandler(request, reply) {
      if (!request.userData) {
        return reply.status(401).send({ message: "User must be logged in" });
      }

      const { userId, organizationId, accessToken } = request.userData;

      const pagination = sanitizePagination({
        limit: request.body.limit,
        offset: request.body.offset,
      });

      const messages = await listMessages({
        loggedInUserData: { userId, organizationId, accessToken },
        query: {
          recipientUserId: request.body.recipientUserId,
          organisationId: request.body.organisationId,
          isSeen: request.body.isSeen,
          search: request.body.search,
          messagesStatus: request.body.status,
          deleted:
            request.body.deleted !== undefined
              ? parseBooleanEnum(request.body.deleted)
              : undefined,
        },
        pagination,
        pool: app.pg.pool,
        logger: request.log,
      });

      return formatAPIResponse({
        data: messages.data,
        request,
        totalCount: messages.totalCount,
      });
    },
  );

  // Message by id
  app.get<{
    Params: GetMessageParams;
    Querystring: GetMessageQuerystring;
    Response: GetMessageResponse;
  }>(
    "/:messageId",
    {
      preValidation: async (req, reply) => {
        let error: unknown;
        try {
          await app.checkPermissions(
            req,
            reply,
            [Permissions.MessageSelf.Read, Permissions.OnboardedCitizen],
            { method: "AND" },
          );
        } catch (err) {
          error = err;
        }

        if (!error) {
          return;
        }

        try {
          await app.checkPermissions(
            req,
            reply,
            [Permissions.MessageOnboarding.Read, Permissions.OnboardedCitizen],
            { method: "AND" },
          );
        } catch (err) {
          error = err;
        }

        if (!error) {
          return;
        }

        await app.checkPermissions(req, reply, [
          Permissions.MessageOnboarding.Read,
        ]);

        if (!req.userData?.isM2MApplication) {
          throw httpErrors.forbidden("Cannot access get message api");
        }
      },
      schema: GetMessageReqSchema,
    },
    async function getMessageHandler(request, reply) {
      if (!request.userData) {
        throw httpErrors.unauthorized("User needs to be logged in");
      }
      const hasOnboardingPermission = await hasPermission({
        app,
        request,
        reply,
        permission: Permissions.MessageOnboarding.Read,
      });

      const loggedInUser = {
        userId: ensureUserIdIsSet(request),
        accessToken: request.userData.accessToken,
      };
      request.log.debug(
        {
          userId: `${loggedInUser.userId.substring(0, 4)}...`,
          hasOnboardingPermission,
        },
        "Getting message",
      );

      const gotMessage = await getMessage({
        pool: app.pg.pool,
        messageId: request.params.messageId,
        loggedInUser,
        logger: request.log,
        hasOnboardingPermission,
        deleted:
          request.query.deleted !== undefined
            ? parseBooleanEnum(request.query.deleted)
            : undefined,
      });
      return {
        data: gotMessage,
      };
    },
  );

  app.post<{ Body: CreateMessageBody; Response: GenericIdResponse }>(
    "/",
    {
      preValidation: (req, res) =>
        app.checkPermissions(req, res, [
          Permissions.Message.Write,
          Permissions.Scheduler.Write,
        ]),
      schema: CreateMessageReqSchema,
    },
    async function createMessageHandler(request, reply) {
      ensureUserCanAccessUser(request.userData, request.body.recipientUserId);
      const senderUser = {
        id: ensureUserIdIsSet(request),
        organizationId: ensureOrganizationIdIsSet(request),
        isM2MApplication: request.userData?.isM2MApplication ?? false,
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

  app.get(
    "/:messageId/events",
    {
      preValidation: (req, res) =>
        app.checkPermissions(req, res, [Permissions.Event.Read]),
      schema: GetEventsForMessageReqSchema,
    },
    async function getMessageHandler(
      request: FastifyRequestTypebox<typeof GetEventsForMessageReqSchema>,
    ) {
      const messageId = request.params.messageId;
      const organizationId = ensureOrganizationIdIsSet(request);

      (await getM2MAnalyticsSdk(request.log)).track.event({
        event: {
          action: "Events for Message Viewed",
          category: "Event Logs",
          name: "event-view-detail",
        },
      });

      const response = await getEventsForMessageId({
        messageId,
        organizationId,
        pool: app.pg.pool,
      });

      return { data: response };
    },
  );

  app.delete(
    "/",
    {
      preValidation: (req, reply) =>
        app.checkPermissions(
          req,
          reply,
          [Permissions.MessageSelf.Write, Permissions.OnboardedCitizen],
          { method: "AND" },
        ),
      schema: DeleteMessagesReqSchema,
    },
    async function deleteMessagesHandler(
      request: FastifyRequestTypebox<typeof DeleteMessagesReqSchema>,
      reply: FastifyReplyTypebox<typeof DeleteMessagesReqSchema>,
    ) {
      if (!request.userData) {
        throw httpErrors.unauthorized("User needs to be logged in");
      }
      const userId = ensureUserIdIsSet(request);

      const organizationId = request.userData?.organizationId;
      if (organizationId) {
        throw httpErrors.forbidden(
          "Public servant users cannot delete messages",
        );
      }

      const messageIds = request.body.ids;
      await deleteMessages({
        pool: app.pg.pool,
        messageIds,
        logger: request.log,
        loggedInUser: { userId, accessToken: request.userData.accessToken },
      });

      return reply.status(200).send({ data: { ids: messageIds } });
    },
  );
}
