import { describe, expect, it } from "vitest";
import {
  type AcceptedQueryBooleanValues,
  parseBooleanEnum,
  TypeboxBooleanEnum,
  TypeboxStringEnum,
} from "../../types/schemaDefinitions.js"; // Adjust the import path accordingly

describe("TypeboxStringEnum", () => {
  it("should include the default value if provided", () => {
    const enumType = TypeboxStringEnum(["a", "b", "c"], "a");
    expect(enumType.default).toBe("a");
  });

  it("should include the description if provided", () => {
    const enumType = TypeboxStringEnum(
      ["a", "b", "c"],
      undefined,
      "Test description",
    );
    expect(enumType.description).toBe("Test description");
  });
});

describe("TypeboxBooleanEnum", () => {
  it("should include the default value if provided", () => {
    const booleanEnumType = TypeboxBooleanEnum("true");
    expect(booleanEnumType.default).toBe("true");
  });

  it("should include the description if provided", () => {
    const booleanEnumType = TypeboxBooleanEnum(undefined, "Test description");
    expect(booleanEnumType.description).toBe("Test description");
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
