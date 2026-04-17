import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import {
  FeatureFlagsWrapper,
  shouldUseFeatureFlags,
} from "../../utils/feature-flags.js";

declare module "fastify" {
  export interface FastifyInstance {
    featureFlagsClient: FeatureFlagsWrapper | undefined;
  }
}

export default fp(
  async (server: FastifyInstance, _opts: FastifyPluginAsync) => {
    if (shouldUseFeatureFlags(server.config)) {
      server.decorate(
        "featureFlagsClient",
        new FeatureFlagsWrapper({
          url: server.config.FEATURE_FLAGS_URL as string,
          token: server.config.FEATURE_FLAGS_TOKEN as string,
        }),
      );
    }
  },
);
