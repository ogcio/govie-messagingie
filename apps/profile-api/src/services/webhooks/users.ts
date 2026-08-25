import { httpErrors } from "@fastify/sensible";
import type { FastifyBaseLogger } from "fastify";
import type { Pool } from "pg";
import type { LogtoClient } from "~/clients/logto.js";
import type { EnvConfig } from "~/plugins/external/env.js";
import type { LogtoUserCreatedBody } from "~/schemas/webhooks/logto-user-created.js";
import { processUserCreatedOrUpdatedWebhook } from "./process-user-created-updated-webhook.js";

export const processUserWebhook = async (params: {
  body: LogtoUserCreatedBody;
  pool: Pool;
  logger: FastifyBaseLogger;
  config: EnvConfig;
  getLogtoClient: () => Promise<LogtoClient>;
}): Promise<{ id: string | undefined }> => {
  switch (params.body.event) {
    case "User.Data.Updated":
    case "User.Created":
      return processUserCreatedOrUpdatedWebhook({ ...params });
    default:
      throw httpErrors.notImplemented(
        `This event, ${params.body.event}, is not managed yet`,
      );
  }
};
