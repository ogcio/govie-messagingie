import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import { Permissions } from "~/const/permissions.js";
import {
  SupportLatestConsentSchema,
  SupportSubmitConsentsSchema,
} from "~/schemas/consents/support.js";
import type {
  FastifyReplyTypebox,
  FastifyRequestTypebox,
} from "~/schemas/shared.js";
import { getAvailableConsentSubjects } from "~/services/consent-statements/consent-statements-service.js";
import {
  getLatestConsentForUser,
  submitSupportConsents,
} from "~/services/consents/consents-service.js";
import { ensureValidSupportUser } from "~/utils/support-routes.js";

const plugin: FastifyPluginAsyncTypebox = async (fastify: FastifyInstance) => {
  fastify.get(
    "/latest",
    {
      preValidation: (req, res) =>
        fastify.checkPermissions(req, res, [Permissions.Platform.Read]),
      schema: SupportLatestConsentSchema,
    },
    async (
      request: FastifyRequestTypebox<typeof SupportLatestConsentSchema>,
      reply: FastifyReplyTypebox<typeof SupportLatestConsentSchema>,
    ) => {
      const error = ensureValidSupportUser(request, reply);
      if (error) {
        return error;
      }

      const availableSubjects = await getAvailableConsentSubjects({
        pool: fastify.pg.pool,
      });
      const consents = await getLatestConsentForUser({
        pool: fastify.pg.pool,
        userId: request.query.profileId,
        subjects: availableSubjects,
      });

      return reply.send({
        data: { availableSubjects, consents },
      });
    },
  );

  fastify.post(
    "/",
    {
      preValidation: (req, res) =>
        fastify.checkPermissions(req, res, [Permissions.Platform.Write]),
      schema: SupportSubmitConsentsSchema,
    },
    async (
      request: FastifyRequestTypebox<typeof SupportSubmitConsentsSchema>,
      reply: FastifyReplyTypebox<typeof SupportSubmitConsentsSchema>,
    ) => {
      const error = ensureValidSupportUser(request, reply);
      if (error) {
        return error;
      }

      const result = await submitSupportConsents({
        pool: fastify.pg.pool,
        userId: request.body.profileId,
        consentInput: request.body,
        logger: request.log,
      });

      reply.statusCode = 201;
      return reply.send({ data: result.data });
    },
  );
};

export default plugin;
export const autoPrefix = "/api/v1/support/consents";
