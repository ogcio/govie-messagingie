import { httpErrors } from "@fastify/sensible";
import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import type { FastifyRequestTypebox } from "~/schemas/shared.js";
import { LogtoUserCreatedSchema } from "~/schemas/webhooks/logto-user-created.js";
import { processUserWebhook } from "~/services/webhooks/users.js";
import { verifySignature } from "~/utils/verify-signature.js";

const plugin: FastifyPluginAsyncTypebox = async (fastify: FastifyInstance) => {
  fastify.post(
    "/user-login-wh",
    {
      schema: LogtoUserCreatedSchema,
      config: {
        rawBody: true,
      },
    },
    async (request: FastifyRequestTypebox<typeof LogtoUserCreatedSchema>) => {
      const isSignatureVerified = verifySignature(
        fastify.config.LOGTO_WEBHOOK_SIGNING_KEY,
        request.rawBody as Buffer,
        request.headers["logto-signature-sha-256"] as string,
      );
      if (!isSignatureVerified) {
        throw httpErrors.unauthorized("Invalid signature");
      }

      await processUserWebhook({
        body: request.body,
        pool: fastify.pg.pool,
        logger: fastify.log,
        config: fastify.config,
        getLogtoClient: fastify.getLogtoClient,
      });
    },
  );
};

export default plugin;
export const autoPrefix = "";
