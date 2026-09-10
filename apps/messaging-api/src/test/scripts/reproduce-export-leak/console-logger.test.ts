import { afterEach, describe, expect, it, vi } from "vitest";
import { createConsoleLogger } from "../../../scripts/reproduce-export-leak/logging/create-console-logger.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createConsoleLogger", () => {
  it("writes the bare message when no fields are given", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    createConsoleLogger().info("hello");
    expect(info).toHaveBeenCalledWith("hello");
  });

  it("writes the bare message when fields are empty", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    createConsoleLogger().warn("careful", {});
    expect(warn).toHaveBeenCalledWith("careful");
  });

  it("serializes nested fields, arrays, and errors", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    createConsoleLogger().error("boom", {
      err: new Error("bad"),
      list: [1, { deep: true }],
      plain: "x",
    });

    expect(error).toHaveBeenCalledOnce();
    const line = error.mock.calls[0]?.[0] as string;
    expect(line.startsWith("boom ")).toBe(true);
    const payload = JSON.parse(line.slice("boom ".length));
    expect(payload.err).toMatchObject({ name: "Error", message: "bad" });
    expect(payload.err.stack).toEqual(expect.any(String));
    expect(payload.list).toEqual([1, { deep: true }]);
    expect(payload.plain).toBe("x");
  });
});
