import type { FastifyInstance } from "fastify";
import type { JSONWebKeySet } from "jose";
import { describe, expect, it, vi } from "vitest";
import { autoConfig } from "../../plugins/api-auth.js";

const jwks: JSONWebKeySet = { keys: [{ kty: "RSA", kid: "test-key" }] };

const buildFastify = (overrides: Record<string, unknown> = {}) =>
  ({
    config: {
      LOGTO_JWK_ENDPOINT: "https://logto/jwks",
      LOGTO_OIDC_ENDPOINT: "https://logto/oidc",
    },
    log: { debug: vi.fn() },
    ...overrides,
  }) as unknown as FastifyInstance;

describe("api-auth autoConfig", () => {
  it("uses the configured endpoints", () => {
    const params = autoConfig(buildFastify());
    expect(params.jwkEndpoint).toBe("https://logto/jwks");
    expect(params.oidcEndpoint).toBe("https://logto/oidc");
    expect(params.piiHasher).toBeUndefined();
  });

  it("passes the piiHasher through when available", () => {
    const piiHasher = { hash: vi.fn() };
    const params = autoConfig(buildFastify({ piiHasher }));
    expect(params.piiHasher).toBe(piiHasher);
  });

  it("stores and retrieves JWKS via the node cache", async () => {
    const store = new Map<string, unknown>();
    const nodeCache = {
      set: (key: string, value: unknown) => store.set(key, value),
      has: (key: string) => store.has(key),
      get: (key: string) => store.get(key),
    };
    const params = autoConfig(buildFastify({ nodeCache }));

    await params.storeLocalJwkSetFn?.(jwks);
    expect(params.getLocalJwksFn?.()).toEqual(jwks);
  });

  it("returns undefined from getLocalJwksFn when the cache is empty", () => {
    const nodeCache = {
      set: vi.fn(),
      has: () => false,
      get: vi.fn(),
    };
    const params = autoConfig(buildFastify({ nodeCache }));
    expect(params.getLocalJwksFn?.()).toBeUndefined();
  });

  it("tolerates a missing node cache", async () => {
    const params = autoConfig(buildFastify());
    await expect(params.storeLocalJwkSetFn?.(jwks)).resolves.toBeUndefined();
    expect(params.getLocalJwksFn?.()).toBeUndefined();
  });

  it("prefers injected test JWKS over the cache", () => {
    const nodeCache = {
      set: vi.fn(),
      has: () => true,
      get: () => ({ keys: [] }),
    };
    const params = autoConfig(buildFastify({ nodeCache, testJwks: jwks }));
    expect(params.getLocalJwksFn?.()).toBe(jwks);
  });
});
