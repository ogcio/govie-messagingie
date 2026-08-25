import type { FastifySchema } from "fastify";
import fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import metadata from "../../routes/metadata/index.js";
import supportMetadata from "../../routes/metadata/support.js";

type RouteOptionsWithSchema = { schema?: FastifySchema };

const collectUnsafeKeywordPaths = (
  value: unknown,
  path = "schema",
): string[] => {
  if (value === null || typeof value !== "object") {
    return [];
  }

  const record = value as Record<PropertyKey, unknown>;
  const keys = Reflect.ownKeys(record);
  const unsafeKeywordPaths = keys.includes("~unsafe") ? [path] : [];

  for (const key of keys) {
    unsafeKeywordPaths.push(
      ...collectUnsafeKeywordPaths(record[key], `${path}.${String(key)}`),
    );
  }

  return unsafeKeywordPaths;
};

describe("route schemas", () => {
  let app: ReturnType<typeof fastify> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("do not expose TypeBox unsafe keywords to Fastify schema validation", async () => {
    const routeSchemas: FastifySchema[] = [];
    app = fastify();
    app.addHook("onRoute", (routeOptions: RouteOptionsWithSchema) => {
      if (routeOptions.schema) {
        routeSchemas.push(routeOptions.schema);
      }
    });

    await app.register(metadata, { prefix: "/api/v1/metadata" });
    await app.register(supportMetadata, { prefix: "/api/v1/support/metadata" });
    await app.ready();

    expect(collectUnsafeKeywordPaths(routeSchemas)).toEqual([]);
  });
});
