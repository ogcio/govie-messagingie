import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { getOrgAnalyticsSdk } from "~/utils/authentication-factory.js";

const _operationIdToNotTrack: Record<string, boolean> = { healthcheck: true };

export default fp(
  async (server: FastifyInstance, _opts: FastifyPluginAsync) => {
    server.addHook("onRequest", async (request) => {
      const sdk = await getOrgAnalyticsSdk(
        server.config,
        request.log,
        server.config.LOGTO_M2M_ANALYTICS_ORGANIZATION_ID,
      );

      if (!request.originalUrl.includes("/health"))
        sdk.track.event({
          event: {
            action: request.method.toUpperCase(),
            category: "API",
            name: request.originalUrl,
            value: 1,
          },
        });
    });
  },
);
