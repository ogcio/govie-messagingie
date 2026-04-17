import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { getM2MAnalyticsSdk } from "../../utils/authentication-factory.js";

export default fp(
  async (server: FastifyInstance, _opts: FastifyPluginAsync) => {
    const sdk = await getM2MAnalyticsSdk(server.log);

    server.addHook("onRequest", async (request, _reply) => {
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
