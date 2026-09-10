import { describe, expect, it, vi } from "vitest";
import {
  extractBoundary,
  extractFilename,
  isStreamTerminationError,
  logZipSize,
  safeFilename,
  toNdjson,
} from "~/scripts/lifecycle-worker/steps/export-user-data/utils.js";

describe("export-user-data utils", () => {
  describe("safeFilename", () => {
    it("replaces path separators with underscores", () => {
      expect(safeFilename("a/b\\c.txt")).toBe("a_b_c.txt");
      expect(safeFilename("plain.txt")).toBe("plain.txt");
    });
  });

  describe("toNdjson", () => {
    it("returns an empty string for no rows", () => {
      expect(toNdjson([])).toBe("");
    });

    it("serialises rows to newline-delimited JSON", () => {
      expect(toNdjson([{ a: 1 }, { b: 2 }])).toBe('{"a":1}\n{"b":2}\n');
    });
  });

  describe("extractBoundary", () => {
    it("extracts the boundary parameter", () => {
      expect(extractBoundary("multipart/mixed; boundary=abc123")).toBe(
        "abc123",
      );
    });

    it("returns null when no boundary is present", () => {
      expect(extractBoundary("application/json")).toBeNull();
    });
  });

  describe("extractFilename", () => {
    it("extracts the filename from content-disposition", () => {
      expect(
        extractFilename({
          "content-disposition": ['attachment; filename="report.pdf"'],
        }),
      ).toBe("report.pdf");
    });

    it("returns null when the header is missing", () => {
      expect(extractFilename({})).toBeNull();
    });

    it("returns null when there is no filename parameter", () => {
      expect(extractFilename({ "content-disposition": ["inline"] })).toBeNull();
    });
  });

  describe("isStreamTerminationError", () => {
    it("detects terminated stream errors", () => {
      expect(isStreamTerminationError(new Error("Stream Terminated"))).toBe(
        true,
      );
    });

    it("rejects other errors and non-errors", () => {
      expect(isStreamTerminationError(new Error("boom"))).toBe(false);
      expect(isStreamTerminationError("terminated")).toBe(false);
      expect(isStreamTerminationError(undefined)).toBe(false);
    });
  });

  describe("logZipSize", () => {
    it("logs the current archive size in KB", () => {
      const logger = { info: vi.fn() };
      logZipSize({
        zip: { pointer: () => 2048 } as never,
        logger: logger as never,
        logParams: { taskId: "t1" },
      });
      expect(logger.info).toHaveBeenCalledWith(
        { taskId: "t1", sizeKB: 2 },
        expect.stringContaining("Archive size"),
      );
    });
  });
});
