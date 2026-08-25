import {
  SecretsManagerClient,
  type SecretsManagerClientConfig,
} from "@aws-sdk/client-secrets-manager";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

declare module "fastify" {
  export interface FastifyInstance {
    getSecretsManager(): SecretsManagerClient | undefined;
  }
}

export default fp(
  async (fastify: FastifyInstance, _opts: FastifyPluginAsync) => {
    let config: SecretsManagerClientConfig | undefined;
    if (
      !fastify.config.AWS_SECRETS_MANAGER_REGION ||
      !fastify.config.AWS_SECRETS_MANAGER_ENDPOINT
    ) {
      fastify.log.warn(
        "AWS Secrets Manager configuration is incomplete. Secrets Manager client will not be initialized.",
      );
    } else {
      config = {
        region: fastify.config.AWS_SECRETS_MANAGER_REGION,
        endpoint: fastify.config.AWS_SECRETS_MANAGER_ENDPOINT,
      };
      if (
        fastify.config.AWS_ACCESS_KEY_ID &&
        fastify.config.AWS_SECRET_ACCESS_KEY
      ) {
        config.credentials = {
          accessKeyId: fastify.config.AWS_ACCESS_KEY_ID,
          secretAccessKey: fastify.config.AWS_SECRET_ACCESS_KEY,
        };
      }
    }

    const client = config ? new SecretsManagerClient(config) : undefined;

    fastify.decorate("getSecretsManager", () => {
      return client;
    });
  },
  { name: "secrets-manager", dependencies: ["env"] },
);
