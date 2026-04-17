import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import CryptographyService from "../../utils/cryptography-service.js";
import { shouldUseFeatureFlags } from "../../utils/feature-flags.js";

declare module "fastify" {
  export interface FastifyInstance {
    cryptographyService: CryptographyService;
  }
}

export default fp(
  async (server: FastifyInstance, _opts: FastifyPluginAsync) => {
    if (shouldUseFeatureFlags(server.config)) {
      server.decorate(
        "cryptographyService",
        new CryptographyService(server.config),
      );
    }
  },
);
