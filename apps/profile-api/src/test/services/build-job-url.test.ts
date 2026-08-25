import { describe, expect, it } from "vitest";
import { buildJobUrl } from "~/services/profiles/build-job-url.js";

describe("buildJobUrl", () => {
  it("should build a correct URL with all parameters", () => {
    const url = buildJobUrl({
      hostUrl: "https://example.com",
      insertPrivateDetails: true,
      batchIndex: 2,
      onlyPrivateDetails: false,
      totalBatches: 5,
      profileImportId: "import-123",
    });
    expect(url.toString()).toBe(
      "https://example.com/api/v1/jobs/import-profiles/import-123?insertPrivateDetails=true&onlyPrivateDetails=false&batchIndex=2&totalBatches=5",
    );
  });

  it("should handle false booleans and zero batchIndex", () => {
    const url = buildJobUrl({
      hostUrl: "https://host.com",
      insertPrivateDetails: false,
      batchIndex: 0,
      onlyPrivateDetails: false,
      totalBatches: 1,
      profileImportId: "id-456",
    });
    expect(url.toString()).toBe(
      "https://host.com/api/v1/jobs/import-profiles/id-456?insertPrivateDetails=false&onlyPrivateDetails=false&batchIndex=0&totalBatches=1",
    );
  });

  it("should handle different hostUrl formats", () => {
    const url = buildJobUrl({
      hostUrl: "https://api.test.com/",
      insertPrivateDetails: true,
      batchIndex: 1,
      onlyPrivateDetails: true,
      totalBatches: 10,
      profileImportId: "abcde",
    });
    expect(url.toString()).toBe(
      "https://api.test.com/api/v1/jobs/import-profiles/abcde?insertPrivateDetails=true&onlyPrivateDetails=true&batchIndex=1&totalBatches=10",
    );
  });

  it("should handle numeric string conversion", () => {
    const url = buildJobUrl({
      hostUrl: "http://localhost",
      insertPrivateDetails: false,
      batchIndex: 99,
      onlyPrivateDetails: true,
      totalBatches: 100,
      profileImportId: "job-xyz",
    });
    expect(url.searchParams.get("batchIndex")).toBe("99");
    expect(url.searchParams.get("totalBatches")).toBe("100");
  });
});
