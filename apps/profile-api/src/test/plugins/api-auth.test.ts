import type { FastifyInstance } from "fastify";
import type { JSONWebKeySet } from "jose";
import { describe, expect, it, vi } from "vitest";
import { autoConfig } from "~/plugins/internal/api-auth.js";

const JWKS: JSONWebKeySet = { keys: [{ kty: "RSA", kid: "key-1" }] };
const CACHE_KEY = "logto_jwks_key";

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
    log: { debug: vi.fn(), error: vi.fn() },
    nodeCache: opts?.nodeCache,
    testJwks: opts?.testJwks,
  }) as unknown as FastifyInstance;

describe("api-auth autoConfig", () => {
  it("wires the configured endpoints", async () => {
    const config = await autoConfig(buildFastify());

    expect(config.jwkEndpoint).toBe("https://logto.example/jwks");
    expect(config.oidcEndpoint).toBe("https://logto.example/oidc");
  });

  it("stores the jwk set in the node cache with a ttl", async () => {
    const nodeCache = { set: vi.fn(), get: vi.fn(), has: vi.fn() };
    const config = await autoConfig(buildFastify({ nodeCache }));

    await config.storeLocalJwkSetFn?.(JWKS);

    expect(nodeCache.set).toHaveBeenCalledWith(CACHE_KEY, JWKS, 60 * 5);
  });

  it("store is a no-op when the cache is not initialized", async () => {
    const fastify = buildFastify();
    const config = await autoConfig(fastify);

    await expect(config.storeLocalJwkSetFn?.(JWKS)).resolves.toBeUndefined();
  });

  it("store swallows cache write errors", async () => {
    const nodeCache = {
      set: vi.fn(() => {
        throw new Error("cache full");
      }),
      get: vi.fn(),
      has: vi.fn(),
    };
    const config = await autoConfig(buildFastify({ nodeCache }));

    await expect(config.storeLocalJwkSetFn?.(JWKS)).resolves.toBeUndefined();
  });

  it("returns the injected test jwks before consulting the cache", async () => {
    const nodeCache = { set: vi.fn(), get: vi.fn(), has: vi.fn() };
    const config = await autoConfig(
      buildFastify({ nodeCache, testJwks: JWKS }),
    );

    expect(config.getLocalJwksFn?.()).toBe(JWKS);
    expect(nodeCache.has).not.toHaveBeenCalled();
  });

  it("returns undefined when there is no cache", async () => {
    const config = await autoConfig(buildFastify());

    expect(config.getLocalJwksFn?.()).toBeUndefined();
  });

  it("returns undefined when the cache has no jwks entry", async () => {
    const nodeCache = {
      set: vi.fn(),
      get: vi.fn(),
      has: vi.fn(() => false),
    };
    const config = await autoConfig(buildFastify({ nodeCache }));

    expect(config.getLocalJwksFn?.()).toBeUndefined();
  });

  it("returns the cached jwks when present", async () => {
    const nodeCache = {
      set: vi.fn(),
      get: vi.fn(() => JWKS),
      has: vi.fn(() => true),
    };
    const config = await autoConfig(buildFastify({ nodeCache }));

    expect(config.getLocalJwksFn?.()).toBe(JWKS);
    expect(nodeCache.get).toHaveBeenCalledWith(CACHE_KEY);
  });
});
