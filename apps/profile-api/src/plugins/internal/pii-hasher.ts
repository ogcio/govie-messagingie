import { createPiiHasher, type PiiHasher } from "@ogcio/pii-utils/pii-hasher";
import {
  type AwsPepperServiceConfig,
  createAwsPepperService,
} from "@ogcio/pii-utils/pii-hasher/aws";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

declare module "fastify" {
  export interface FastifyInstance {
    piiHasher: PiiHasher | undefined;
  }
}

const HASHER_APPLICATION_ID = "profile-api";

export default fp(
  async (fastify: FastifyInstance) => {
    const secretsManagerClient = fastify.getSecretsManager();
    let piiHasher: PiiHasher | undefined;
    if (
      secretsManagerClient &&
      fastify.config.PII_HASHER_SECRET_NAME &&
      fastify.config.PII_HASHER_SECRET_NAME.trim().length > 0
    ) {
      const hasherConfig: AwsPepperServiceConfig = {
        secretName: fastify.config.PII_HASHER_SECRET_NAME,
        client: secretsManagerClient,
      };
      const pepperService = createAwsPepperService(hasherConfig);

      piiHasher = createPiiHasher({
        pepperService,
        applicationId: HASHER_APPLICATION_ID,
      });

      await piiHasher.warmup();

      fastify.addHook("onClose", (instance, done) => {
        instance.log.debug("Disposing PII hasher plugin resources");
        instance.piiHasher?.dispose();
        instance.piiHasher = undefined;
        instance.log.debug("PII hasher plugin resources disposed");
        done();
      });
    }
    fastify.decorate("piiHasher", piiHasher);
  },
  { name: "pii-hasher", dependencies: ["env", "secrets-manager"] },
);
