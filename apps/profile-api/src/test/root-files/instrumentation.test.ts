import { describe, expect, it } from "vitest";

describe("Instrumentation", () => {
  it("should be imported without throwing", async () => {
    await expect(import("~/instrumentation.js")).resolves.not.toThrow();
  });
});
