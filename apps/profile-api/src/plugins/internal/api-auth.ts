import apiAuthPlugin, {
  type CheckPermissionsPluginOpts,
} from "@ogcio/api-auth";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import type { JSONWebKeySet } from "jose";

const JWKS_CACHE_KEY = "logto_jwks_key";
const JWKS_CACHE_TTL = 60 * 5; // 5 minutes

export const autoConfig = async (
  fastify: FastifyInstance,
): Promise<CheckPermissionsPluginOpts> => {
  // Check if test JWKS is injected (for testing purposes)
  const testJwks = (fastify as FastifyInstance & { testJwks?: JSONWebKeySet })
    .testJwks;

  const params: CheckPermissionsPluginOpts = {
    jwkEndpoint: fastify.config.LOGTO_JWK_ENDPOINT,
    oidcEndpoint: fastify.config.LOGTO_OIDC_ENDPOINT,
    storeLocalJwkSetFn: (jwkSet: JSONWebKeySet): Promise<void> => {
      if (!fastify.nodeCache) {
        fastify.log.debug("[storeLocalJwkSetFn] Node cache is not initialized");
        return Promise.resolve();
      }
      try {
        fastify.nodeCache.set(JWKS_CACHE_KEY, jwkSet, JWKS_CACHE_TTL);
      } catch (error) {
        fastify.log.error(
          { error },
          "[storeLocalJwkSetFn] Error storing JWKS in node cache",
        );
      }
      return Promise.resolve();
    },
    getLocalJwksFn: (): JSONWebKeySet | undefined => {
      // First check if test JWKS is injected
      if (testJwks) {
        fastify.log.debug("[getLocalJwksFn] Returning test JWKS");
        return testJwks;
      }

      if (!fastify.nodeCache) {
        fastify.log.debug("[getLocalJwksFn] Node cache is not initialized");
        return undefined;
      }
      if (!fastify.nodeCache.has(JWKS_CACHE_KEY)) {
        fastify.log.debug("[getLocalJwksFn] No JWKS found in node cache");
        return undefined;
      }

      const cachedJwks = fastify.nodeCache.get(JWKS_CACHE_KEY) as
        | JSONWebKeySet
        | undefined;

      fastify.log.debug(
        "[getLocalJwksFn] Returning cached JWKS from node cache",
      );

      return cachedJwks;
    },
  };

  const piiHasher = fastify.piiHasher;
  if (piiHasher) {
    params.piiHasher = piiHasher;
  }

  return params;
};

export default fp(
  async (fastify: FastifyInstance) => {
    await fastify.register(apiAuthPlugin, await autoConfig(fastify));
  },
  {
    name: "api-auth",
    dependencies: ["env", "secrets-manager", "pii-hasher"],
  },
);
