import { initializeErrorHandler } from "@ogcio/fastify-error-handler";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

export default fp(
  async (server: FastifyInstance, _opts: FastifyPluginAsync) => {
    initializeErrorHandler(server);
  },
);
