import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { buildLogtoClient, type LogtoClient } from "~/clients/logto.js";

declare module "fastify" {
  export interface FastifyInstance {
    getLogtoClient(): Promise<LogtoClient>;
  }
}

export default fp(
  async (server: FastifyInstance, _opts: FastifyPluginAsync) => {
    server.decorate("getLogtoClient", () => buildLogtoClient(server.config));
  },
);
