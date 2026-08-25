import { initializeLoggingHooks } from "@ogcio/fastify-logging-wrapper";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

export default fp(
  async (server: FastifyInstance, _opts: FastifyPluginAsync) => {
    initializeLoggingHooks(server);
  },
);
