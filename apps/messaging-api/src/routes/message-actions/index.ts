import { httpErrors } from "@fastify/sensible";
import type { FastifyInstance } from "fastify";
import { updateMessageAction } from "../../services/message-actions/message-action-service.js";
import {
  type PutMessageActionBody,
  type PutMessageActionParams,
  PutMessageActionReqSchema,
  type PutMessageActionResponse,
} from "../../types/message-actions.js";
import { Permissions } from "../../types/permissions.js";
import { ensureUserIdIsSet } from "../../utils/authentication-factory.js";

export const prefix = "/message-actions";

export default async function messagesActions(app: FastifyInstance) {
  app.put<{
    Body: PutMessageActionBody;
    Params: PutMessageActionParams;
    Response: PutMessageActionResponse;
  }>(
    "/:messageId",
    {
      preValidation: (req, res) =>
        app.checkPermissions(
          req,
          res,
          [Permissions.MessageSelf.Write, Permissions.OnboardedCitizen],
          { method: "AND" },
        ),
      schema: PutMessageActionReqSchema,
    },
    async function putMessageOptions(req) {
      if (!req.userData) {
        throw httpErrors.unauthorized("User needs to be logged in");
      }

      const messageOptionId = req.params.messageId;
      if (messageOptionId !== req.body.messageId) {
        throw app.httpErrors.badRequest("url params id mismatch with body id");
      }

      await updateMessageAction({
        loggedInUser: {
          userId: ensureUserIdIsSet(req),
          accessToken: req.userData?.accessToken,
        },
        body: req.body,
        pool: app.pg.pool,
        logger: req.log,
      });
    },
  );
}
