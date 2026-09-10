import { describe, expect, it } from "vitest";
import { getUploadLimit } from "../../../../routes/files/utils/getUploadLimit.js";

describe("getUploadLimit", () => {
  it("returns the configured limit when it is a valid integer", () => {
    expect(getUploadLimit({ UPLOAD_LIMIT_PER_IP_PER_MINUTE: 10 })).toBe(10);
  });

  it("falls back to 250 when the limit is not configured", () => {
    expect(getUploadLimit({})).toBe(250);
  });

  it("falls back to 250 when the limit is not an integer", () => {
    expect(getUploadLimit({ UPLOAD_LIMIT_PER_IP_PER_MINUTE: 10.5 })).toBe(250);
  });
});
