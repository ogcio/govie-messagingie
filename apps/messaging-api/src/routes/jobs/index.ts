import type { FastifyInstance } from "fastify";
import { executeJob } from "../../services/jobs/job-service.js";
import { MessagingEventLogger } from "../../services/messages/event-logger.js";
import {
  type ExecuteJobBody,
  type ExecuteJobParams,
  ExecuteJobReqSchema,
} from "../../types/jobs.js";

export const prefix = "/jobs";

export default async function jobs(app: FastifyInstance) {
  app.post<{ Params: ExecuteJobParams; Body: ExecuteJobBody }>(
    "/:jobId",
    {
      schema: ExecuteJobReqSchema,
    },
    async function jobHandler(request, reply) {
      const eventLogger = new MessagingEventLogger(app.pg.pool, request.log);
      try {
        await executeJob({
          config: app.config,
          pool: app.pg.pool,
          logger: request.log,
          jobId: request.params.jobId,
          token: request.body.token,
          eventLogger,
          i18n: app.i18n,
          cache: app.nodeCache,
        });
      } finally {
        await eventLogger.commit();
      }
      reply.statusCode = 202;
    },
  );
}
