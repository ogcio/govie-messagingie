import { describe, expect, it } from "vitest";
import { getPackageInfo } from "../../utils/get-package-info.js";

describe("getPackageInfo", () => {
  it("returns the name and version from package.json", async () => {
    // Tests run with cwd = apps/upload-api, so path.resolve("package.json")
    // points at this app's manifest.
    const info = await getPackageInfo();

    expect(info.name).toBe("upload-api");
    expect(typeof info.version).toBe("string");
    expect(info.version.length).toBeGreaterThan(0);
  });
});
