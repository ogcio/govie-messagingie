import fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { exportJWK, generateKeyPair, type JSONWebKeySet } from "jose";
import { vi } from "vitest";
import buildServer from "../app.js";

declare module "fastify" {
  interface FastifyInstance {}
}

// Cache the key pair globally to avoid regenerating for each test
let cachedKeyPair: { publicKey: CryptoKey; privateKey: CryptoKey } | null =
  null;
let cachedJwks: JSONWebKeySet | null = null;

async function getOrCreateKeyPair() {
  if (!cachedKeyPair) {
    cachedKeyPair = await generateKeyPair("RS256", { extractable: true });
    const publicJwk = await exportJWK(cachedKeyPair.publicKey);
    cachedJwks = {
      keys: [
        {
          ...publicJwk,
          kid: "test-key-id",
          alg: "RS256",
          use: "sig",
        },
      ],
    };
  }
  if (!cachedJwks) {
    throw new Error("JWKS not initialized");
  }
  return { keyPair: cachedKeyPair, jwks: cachedJwks };
}

// automatically build and tear down our instance
export async function build() {
  const app = fastify({
    ajv: {
      customOptions: {
        coerceTypes: false,
        removeAdditional: "all",
      },
    },
  });
  const { jwks } = await getOrCreateKeyPair();
  // Inject test JWKS before server registration (for api-auth plugin)

  (app as FastifyInstance & { testJwks?: JSONWebKeySet }).testJwks = jwks;

  app.register(fp(buildServer));

  return app;
}

export function getMockBaseLogger(level = "info"): FastifyBaseLogger {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
    silent: vi.fn(),
    level,
  };
}
