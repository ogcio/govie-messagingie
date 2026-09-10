import type { FastifyInstance } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const warmupMock = vi.fn().mockResolvedValue(undefined);
const disposeMock = vi.fn();
const createPiiHasherMock = vi.fn((..._args: unknown[]) => ({
  warmup: warmupMock,
  dispose: disposeMock,
}));
const createAwsPepperServiceMock = vi.fn((..._args: unknown[]) => ({
  pepper: "service",
}));

vi.mock("@ogcio/pii-utils/pii-hasher", () => ({
  createPiiHasher: (...args: unknown[]) => createPiiHasherMock(...args),
}));

vi.mock("@ogcio/pii-utils/pii-hasher/aws", () => ({
  createAwsPepperService: (...args: unknown[]) =>
    createAwsPepperServiceMock(...args),
}));

type OnCloseHook = (instance: FastifyInstance, done: () => void) => void;

const buildFastify = (
  config: Record<string, unknown>,
  secretsClient?: unknown,
) => {
  const decorations: Record<string, unknown> = {};
  const onCloseHooks: OnCloseHook[] = [];
  const fastify = {
    config,
    getSecretsManager: () => secretsClient,
    decorate: (name: string, value: unknown) => {
      decorations[name] = value;
    },
    addHook: (_name: string, hook: OnCloseHook) => {
      onCloseHooks.push(hook);
    },
    log: { debug: vi.fn() },
  } as unknown as FastifyInstance;
  return { fastify, decorations, onCloseHooks };
};

describe("pii-hasher plugin", async () => {
  const plugin = (await import("../../plugins/pii-hasher.js"))
    .default as unknown as (fastify: FastifyInstance) => Promise<void>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates and warms up the hasher when configured", async () => {
    const { fastify, decorations } = buildFastify(
      { PII_HASHER_SECRET_NAME: "secret-name" },
      { client: true },
    );

    await plugin(fastify);

    expect(createAwsPepperServiceMock).toHaveBeenCalledWith({
      secretName: "secret-name",
      client: { client: true },
    });
    expect(createPiiHasherMock).toHaveBeenCalledWith(
      expect.objectContaining({ applicationId: "upload-api" }),
    );
    expect(warmupMock).toHaveBeenCalled();
    expect(decorations.piiHasher).toBeDefined();
  });

  it("disposes the hasher on close", async () => {
    const { fastify, decorations, onCloseHooks } = buildFastify(
      { PII_HASHER_SECRET_NAME: "secret-name" },
      { client: true },
    );

    await plugin(fastify);

    const instance = {
      log: { debug: vi.fn() },
      piiHasher: decorations.piiHasher,
    } as unknown as FastifyInstance;
    const done = vi.fn();
    for (const hook of onCloseHooks) hook(instance, done);

    expect(disposeMock).toHaveBeenCalled();
    expect(instance.piiHasher).toBeUndefined();
    expect(done).toHaveBeenCalled();
  });

  it("decorates undefined when the secret name is missing", async () => {
    const { fastify, decorations } = buildFastify({}, { client: true });

    await plugin(fastify);

    expect(createPiiHasherMock).not.toHaveBeenCalled();
    expect(decorations.piiHasher).toBeUndefined();
  });

  it("decorates undefined when the secret name is blank", async () => {
    const { fastify, decorations } = buildFastify(
      { PII_HASHER_SECRET_NAME: "   " },
      { client: true },
    );

    await plugin(fastify);

    expect(createPiiHasherMock).not.toHaveBeenCalled();
    expect(decorations.piiHasher).toBeUndefined();
  });

  it("decorates undefined when the secrets manager is unavailable", async () => {
    const { fastify, decorations } = buildFastify(
      { PII_HASHER_SECRET_NAME: "secret-name" },
      undefined,
    );

    await plugin(fastify);

    expect(createPiiHasherMock).not.toHaveBeenCalled();
    expect(decorations.piiHasher).toBeUndefined();
  });
});
