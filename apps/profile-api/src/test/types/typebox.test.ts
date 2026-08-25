import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import fastify, { type FastifyInstance } from "fastify";
import { Type } from "typebox";
import { afterEach, describe, expect, it } from "vitest";
import {
  type AcceptedQueryBooleanValues,
  parseBooleanEnum,
  TypeboxBooleanEnum,
  TypeboxStringEnum,
} from "~/types/typebox.js"; // Adjust the import path accordingly

describe("TypeboxStringEnum", () => {
  it("should include the default value if provided", () => {
    const enumType = TypeboxStringEnum(["a", "b", "c"], "a");
    expect(enumType).toMatchObject({ default: "a" });
  });

  it("should include the description if provided", () => {
    const enumType = TypeboxStringEnum(
      ["a", "b", "c"],
      undefined,
      "Test description",
    );
    expect(enumType).toMatchObject({ description: "Test description" });
  });
});

describe("TypeboxBooleanEnum", () => {
  it("should include the default value if provided", () => {
    const booleanEnumType = TypeboxBooleanEnum("true");
    expect(booleanEnumType).toMatchObject({ default: "true" });
  });

  it("should include the description if provided", () => {
    const booleanEnumType = TypeboxBooleanEnum(undefined, "Test description");
    expect(booleanEnumType).toMatchObject({ description: "Test description" });
  });
});

describe("parseBooleanEnum", () => {
  it("should parse 'true' as true", () => {
    expect(parseBooleanEnum("true")).toBe(true);
  });

  it("should parse '1' as true", () => {
    expect(parseBooleanEnum("1")).toBe(true);
  });

  it("should parse 'false' as false", () => {
    expect(parseBooleanEnum("false")).toBe(false);
  });

  it("should parse '0' as false", () => {
    expect(parseBooleanEnum("0")).toBe(false);
  });

  it("should throw an error for invalid input", () => {
    // Test with an invalid value (not part of AcceptedQueryBooleanValues)
    expect(() =>
      parseBooleanEnum("invalid" as AcceptedQueryBooleanValues),
    ).toThrow();
  });
});

// Regression for the typebox@1.3.0 upgrade: `Type.Unsafe(...)` attaches an own
// `~unsafe` runtime property that Fastify forwards to Ajv, which rejects it in
// strict mode as an unknown keyword and fails route registration at startup.
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

// TypeScript does not expose `.enum` on wrapper types such as
// `TOptional<TUnsafe<T>>`, so assert through an `unknown` helper.
const expectSchemaEnum = (
  schema: unknown,
  expectedValues: readonly string[],
) => {
  expect(schema).toMatchObject({ enum: expectedValues });
};

describe("TypeboxStringEnum does not emit the `~unsafe` keyword", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
  });

  const routeSchemas = {
    querystring: Type.Object({
      status: TypeboxStringEnum(
        ["active", "inactive"],
        undefined,
        "Status filter",
      ),
      includeMetadata: Type.Optional(TypeboxBooleanEnum()),
    }),
  };

  it("registers with Ajv strict mode and exposes the expected enum values", async () => {
    // Mirror the production validator setup from src/index.ts (Ajv strict mode
    // stays enabled). Before the fix this `ready()` rejected with
    // 'strict mode: unknown keyword: "~unsafe"'.
    app = fastify({
      ajv: {
        customOptions: {
          coerceTypes: false,
          removeAdditional: "all",
        },
      },
    }).withTypeProvider<TypeBoxTypeProvider>();

    app.get("/items", { schema: routeSchemas }, async () => ({ data: [] }));

    await expect(app.ready()).resolves.toBeDefined();

    expectSchemaEnum(routeSchemas.querystring.properties.status, [
      "active",
      "inactive",
    ]);
    expectSchemaEnum(routeSchemas.querystring.properties.includeMetadata, [
      "true",
      "false",
      "0",
      "1",
    ]);

    expect(collectUnsafeKeywordPaths(routeSchemas)).toEqual([]);
  });
});
