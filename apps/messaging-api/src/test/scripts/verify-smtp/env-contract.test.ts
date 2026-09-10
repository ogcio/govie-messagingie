import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  getOptionalEnvValue,
  getRequiredEnvValue,
  REQUIRED_ENV_KEYS,
  validateEnvSample,
} from "../../../scripts/verify-smtp/config/env-contract.js";

const createdDirs: string[] = [];

async function makeScriptRoot(sampleLines: readonly string[]) {
  const scriptRoot = await mkdtemp(join(tmpdir(), "verify-smtp-env-"));
  createdDirs.push(scriptRoot);
  await writeFile(join(scriptRoot, ".env.sample"), sampleLines.join("\n"));
  return scriptRoot;
}

afterEach(async () => {
  await Promise.all(
    createdDirs
      .splice(0)
      .map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("validateEnvSample", () => {
  it("accepts a sample listing exactly the known keys with comments", async () => {
    const scriptRoot = await makeScriptRoot([
      "# comment",
      "",
      ...REQUIRED_ENV_KEYS.map((key) => `${key}=`),
      "EMAIL_PROVIDER_SMTP_FROM_ADDRESS=",
    ]);

    await expect(validateEnvSample(scriptRoot)).resolves.toBeUndefined();
  });

  it("rejects a sample missing a required key", async () => {
    const scriptRoot = await makeScriptRoot(
      REQUIRED_ENV_KEYS.slice(1).map((key) => `${key}=`),
    );

    await expect(validateEnvSample(scriptRoot)).rejects.toThrow(
      /missing EMAIL_PROVIDER_SMTP_HOST/,
    );
  });

  it("rejects a sample with an unexpected key", async () => {
    const scriptRoot = await makeScriptRoot([
      ...REQUIRED_ENV_KEYS.map((key) => `${key}=`),
      "SOMETHING_ELSE=",
    ]);

    await expect(validateEnvSample(scriptRoot)).rejects.toThrow(
      /unexpected SOMETHING_ELSE/,
    );
  });
});

describe("getRequiredEnvValue", () => {
  it("returns the trimmed value", () => {
    const problems: string[] = [];
    const value = getRequiredEnvValue(
      { EMAIL_PROVIDER_SMTP_HOST: "  smtp.example.com  " },
      "EMAIL_PROVIDER_SMTP_HOST",
      problems,
    );
    expect(value).toBe("smtp.example.com");
    expect(problems).toEqual([]);
  });

  it("records a problem for missing or blank values", () => {
    const problems: string[] = [];
    expect(
      getRequiredEnvValue({}, "EMAIL_PROVIDER_SMTP_HOST", problems),
    ).toBeUndefined();
    expect(
      getRequiredEnvValue(
        { EMAIL_PROVIDER_SMTP_PORT: "   " },
        "EMAIL_PROVIDER_SMTP_PORT",
        problems,
      ),
    ).toBeUndefined();
    expect(problems).toEqual([
      "EMAIL_PROVIDER_SMTP_HOST is required",
      "EMAIL_PROVIDER_SMTP_PORT is required",
    ]);
  });
});

describe("getOptionalEnvValue", () => {
  it("returns trimmed value when set, undefined when blank or missing", () => {
    expect(
      getOptionalEnvValue(
        { EMAIL_PROVIDER_SMTP_FROM_ADDRESS: " a@b.ie " },
        "EMAIL_PROVIDER_SMTP_FROM_ADDRESS",
      ),
    ).toBe("a@b.ie");
    expect(
      getOptionalEnvValue(
        { EMAIL_PROVIDER_SMTP_FROM_ADDRESS: "  " },
        "EMAIL_PROVIDER_SMTP_FROM_ADDRESS",
      ),
    ).toBeUndefined();
    expect(
      getOptionalEnvValue({}, "EMAIL_PROVIDER_SMTP_FROM_ADDRESS"),
    ).toBeUndefined();
  });
});
