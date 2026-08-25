import type { FastifyInstance, FastifyServerOptions } from "fastify";
import fp from "fastify-plugin";
import { getM2MAnalyticsSdk } from "../utils/authentication-factory.js";

export default fp(
  async (server: FastifyInstance, _opts: FastifyServerOptions) => {
    if (!process.env.ANALYTICS_URL || process.env.ANALYTICS_URL.trim() === "") {
      server.log.warn("ANALYTICS_URL is not set. Analytics will be disabled.");
      return;
    }

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
