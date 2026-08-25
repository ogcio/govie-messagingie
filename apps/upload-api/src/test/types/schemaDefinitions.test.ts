import { describe, expect, it } from "vitest";
import { FileMetadata } from "../../types/schemaDefinitions.js";

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

describe("schema definitions", () => {
  it("do not expose TypeBox unsafe keywords", () => {
    expect(collectUnsafeKeywordPaths(FileMetadata)).toEqual([]);
  });
});
