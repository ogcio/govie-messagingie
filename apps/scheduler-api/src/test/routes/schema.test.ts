import type { FastifySchema } from "fastify";
import fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import routes from "../../routes/index.js";

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

    await app.register(routes, { prefix: "/api/v1" });
    await app.ready();

    expect(collectUnsafeKeywordPaths(routeSchemas)).toEqual([]);
  });
});
