import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import {
  CONFIG_TYPE,
  getConfigValue,
  storeConfig,
} from "../../utils/storeConfig.js";

describe("storeConfig", () => {
  it("should execute store config query with the correct params", async () => {
    const params: string[] = [];

    const poolMock = {
      query: (...values: string[]) => {
        params.push(...values);
      },
    } as unknown as Pool;
    await storeConfig(
      poolMock,
      "key",
      "value",
      "a test key to store",
      CONFIG_TYPE.STRING,
    );

    expect(params[1]).toMatchObject([
      "key",
      "value",
      "string",
      "a test key to store",
    ]);
  });

  it("should return undefined when a config key is not found", async () => {
    const poolMock = {
      query: () =>
        Promise.resolve({
          rows: [],
        }),
    } as unknown as Pool;
    const value = await getConfigValue(poolMock, "key");

    expect(value).toBeUndefined();
  });

  it("should return a string value", async () => {
    const poolMock = {
      query: () =>
        Promise.resolve({
          rows: [{ value: "value", type: "string" }],
        }),
    } as unknown as Pool;
    const value = await getConfigValue(poolMock, "key");

    expect(value).toBe("value");
    expect(typeof value).toBe("string");
  });

  it("should return a numeric value", async () => {
    const poolMock = {
      query: () =>
        Promise.resolve({
          rows: [{ value: "1", type: "number" }],
        }),
    } as unknown as Pool;
    const value = await getConfigValue(poolMock, "key");

    expect(value).toBe(1);
    expect(typeof value).toBe("number");
  });

  it("should return a boolean value", async () => {
    const poolMock = {
      query: () =>
        Promise.resolve({
          rows: [{ value: "true", type: "boolean" }],
        }),
    } as unknown as Pool;
    const value = await getConfigValue(poolMock, "key");

    expect(value).toBe(true);
    expect(typeof value).toBe("boolean");
  });
});
