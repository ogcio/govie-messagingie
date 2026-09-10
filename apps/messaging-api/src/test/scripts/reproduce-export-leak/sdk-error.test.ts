import { describe, expect, it } from "vitest";
import { extractSdkErrorDetail } from "../../../scripts/reproduce-export-leak/clients/sdk-error.js";

describe("extractSdkErrorDetail", () => {
  it("normalizes raw string bodies (proxy/WAF responses)", () => {
    expect(extractSdkErrorDetail("  <html>\n  Blocked  </html>  ")).toBe(
      "<html> Blocked </html>",
    );
  });

  it("truncates long string bodies to 300 characters", () => {
    const detail = extractSdkErrorDetail("x".repeat(500));
    expect(detail).toHaveLength(300);
  });

  it("prefers the detail field", () => {
    expect(extractSdkErrorDetail({ detail: "not found", code: "404" })).toBe(
      "not found",
    );
  });

  it("falls back to the code field when detail is missing or empty", () => {
    expect(extractSdkErrorDetail({ detail: "", code: "FORBIDDEN" })).toBe(
      "FORBIDDEN",
    );
  });

  it("stringifies unknown record shapes", () => {
    expect(extractSdkErrorDetail({ weird: true })).toBe('{"weird":true}');
  });

  it("returns a fallback for non-object errors", () => {
    expect(extractSdkErrorDetail(42)).toBe("unknown SDK error");
    expect(extractSdkErrorDetail(null)).toBe("unknown SDK error");
  });

  it("returns a fallback for unserializable records", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(extractSdkErrorDetail(circular)).toBe("unknown SDK error");
  });
});
