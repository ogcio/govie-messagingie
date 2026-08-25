import { afterAll, assert, describe, expect, test, vi } from "vitest";
import { getPackageInfo } from "~/utils/get-package-info.js";

const throwErrorTestName = "throw-error";
let currentTest: string;

vi.mock("node:path", () => {
  return {
    default: {
      resolve: (filename: string) => {
        if (currentTest === throwErrorTestName) {
          throw new Error(`File does not exist: ${filename}`);
        }

        return `the/path/${filename}`;
      },
    },
  };
});
vi.mock("node:fs", () => {
  return {
    promises: {
      readFile: (_filename: string, _encoding: string): Promise<string> =>
        Promise.resolve('{"version": "x.x.x", "name": "test-mock"}'),
    },
  };
});

describe("Get package info works as expected", {}, async () => {
  afterAll(() => {
    vi.restoreAllMocks();
  });

  test.sequential("extracts the correct data", async () => {
    currentTest = "successful-one";
    const packageInfo = await getPackageInfo();

    assert.deepStrictEqual("x.x.x", packageInfo.version);
    assert.deepStrictEqual("test-mock", packageInfo.name);
  });

  test.sequential("throws error if file not found", async () => {
    currentTest = throwErrorTestName;
    await expect(() => getPackageInfo()).rejects.toThrowError(
      "File does not exist: package.json",
    );
  });
});
