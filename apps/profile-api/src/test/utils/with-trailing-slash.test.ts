import { describe, expect, it } from "vitest";
import { trimSlash, withTrailingSlash } from "~/utils/with-trailing-slash.js";

describe("withTrailingSlash", () => {
  it("appends a slash when missing", () => {
    expect(withTrailingSlash("http://example.com")).toBe("http://example.com/");
  });

  it("collapses repeated trailing slashes to one", () => {
    expect(withTrailingSlash("http://example.com///")).toBe(
      "http://example.com/",
    );
  });
});

describe("trimSlash", () => {
  it("removes all trailing slashes", () => {
    expect(trimSlash("path///")).toBe("path");
    expect(trimSlash("path")).toBe("path");
  });

  it("returns an empty string for only slashes", () => {
    expect(trimSlash("///")).toBe("");
  });
});
