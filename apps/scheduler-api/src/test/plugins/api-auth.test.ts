import type { FastifyInstance } from "fastify";
import type { JSONWebKeySet } from "jose";
import { describe, expect, it, vi } from "vitest";
import { autoConfig } from "../../plugins/api-auth.js";

const JWKS: JSONWebKeySet = { keys: [{ kty: "RSA", kid: "key-1" }] };

const buildFastify = (opts?: {
  nodeCache?: {
    set: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    has: ReturnType<typeof vi.fn>;
  };
  testJwks?: JSONWebKeySet;
}) =>
  ({
    config: {
      LOGTO_JWK_ENDPOINT: "https://logto.example/jwks",
      LOGTO_OIDC_ENDPOINT: "https://logto.example/oidc",
    },
    log: { debug: vi.fn() },
    nodeCache: opts?.nodeCache,
    testJwks: opts?.testJwks,
  }) as unknown as FastifyInstance;

describe("api-auth autoConfig", () => {
  it("wires the configured endpoints", () => {
    const config = autoConfig(buildFastify());

    expect(config.jwkEndpoint).toBe("https://logto.example/jwks");
    expect(config.oidcEndpoint).toBe("https://logto.example/oidc");
  });

  it("stores the jwk set in the node cache with a ttl", async () => {
    const nodeCache = { set: vi.fn(), get: vi.fn(), has: vi.fn() };
    const config = autoConfig(buildFastify({ nodeCache }));

    await config.storeLocalJwkSetFn?.(JWKS);

    expect(nodeCache.set).toHaveBeenCalledWith("logto_jwks_key", JWKS, 60 * 5);
  });

  it("store is a no-op when the cache is not initialized", async () => {
    const fastify = buildFastify();
    const config = autoConfig(fastify);

    await expect(config.storeLocalJwkSetFn?.(JWKS)).resolves.toBeUndefined();
    expect(fastify.log.debug).toHaveBeenCalledWith(
      "[storeLocalJwkSetFn] Node cache is not initialized",
    );
  });

  it("returns the injected test jwks before consulting the cache", () => {
    const nodeCache = { set: vi.fn(), get: vi.fn(), has: vi.fn() };
    const config = autoConfig(buildFastify({ nodeCache, testJwks: JWKS }));

    expect(config.getLocalJwksFn?.()).toBe(JWKS);
    expect(nodeCache.has).not.toHaveBeenCalled();
  });

  it("returns undefined when the cache is not initialized", () => {
    const config = autoConfig(buildFastify());

    expect(config.getLocalJwksFn?.()).toBeUndefined();
  });

  it("returns undefined when no jwks is cached", () => {
    const nodeCache = {
      set: vi.fn(),
      get: vi.fn(),
      has: vi.fn().mockReturnValue(false),
    };
    const config = autoConfig(buildFastify({ nodeCache }));

    expect(config.getLocalJwksFn?.()).toBeUndefined();
    expect(nodeCache.get).not.toHaveBeenCalled();
  });

  it("returns the cached jwks", () => {
    const nodeCache = {
      set: vi.fn(),
      get: vi.fn().mockReturnValue(JWKS),
      has: vi.fn().mockReturnValue(true),
    };
    const config = autoConfig(buildFastify({ nodeCache }));

    expect(config.getLocalJwksFn?.()).toBe(JWKS);
    expect(nodeCache.get).toHaveBeenCalledWith("logto_jwks_key");
  });
});
