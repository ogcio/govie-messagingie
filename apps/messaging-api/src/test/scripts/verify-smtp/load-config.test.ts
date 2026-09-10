import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CliCommand } from "../../../scripts/verify-smtp/cli.js";
import {
  OPTIONAL_ENV_KEYS,
  REQUIRED_ENV_KEYS,
} from "../../../scripts/verify-smtp/config/env-contract.js";
import { loadConfig } from "../../../scripts/verify-smtp/config/load-config.js";

const createdDirs: string[] = [];
const ALL_KEYS = [...REQUIRED_ENV_KEYS, ...OPTIONAL_ENV_KEYS];

async function makeScriptRoot(envLines: readonly string[]) {
  const scriptRoot = await mkdtemp(join(tmpdir(), "verify-smtp-config-"));
  createdDirs.push(scriptRoot);
  await writeFile(
    join(scriptRoot, ".env.sample"),
    ALL_KEYS.map((key) => `${key}=`).join("\n"),
  );
  await writeFile(join(scriptRoot, ".env"), envLines.join("\n"));
  return scriptRoot;
}

afterEach(async () => {
  for (const key of ALL_KEYS) {
    delete process.env[key];
  }
  await Promise.all(
    createdDirs
      .splice(0)
      .map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

const envConfigCommand: CliCommand = { kind: "env-config" };

describe("verify-smtp loadConfig", () => {
  it("passes through explicit cli flags without touching the env file", async () => {
    const { smtp, summary } = await loadConfig(
      {
        kind: "explicit",
        host: "smtp.example.com",
        port: 465,
        username: "user",
        password: "pass",
        secure: true,
        fromAddress: undefined,
      },
      "/nonexistent",
    );

    expect(smtp).toEqual({
      host: "smtp.example.com",
      port: 465,
      username: "user",
      password: "pass",
      secure: true,
      fromAddress: undefined,
    });
    expect(summary.source).toBe("cli-flags");
  });

  it("loads config from the colocated .env file", async () => {
    const scriptRoot = await makeScriptRoot([
      "EMAIL_PROVIDER_SMTP_HOST=smtp.env.example",
      "EMAIL_PROVIDER_SMTP_PORT=2525",
      "EMAIL_PROVIDER_SMTP_USERNAME=env-user",
      "EMAIL_PROVIDER_SMTP_PASSWORD=env-pass",
      "EMAIL_PROVIDER_SMTP_USE_SSL=false",
      "EMAIL_PROVIDER_SMTP_FROM_ADDRESS=from@env.example",
    ]);

    const { smtp, summary } = await loadConfig(envConfigCommand, scriptRoot);

    expect(smtp).toEqual({
      host: "smtp.env.example",
      port: 2525,
      username: "env-user",
      password: "env-pass",
      secure: false,
      fromAddress: "from@env.example",
    });
    expect(summary).toMatchObject({ source: "env-file", port: 2525 });
  });

  it("aggregates every env problem into one error", async () => {
    const scriptRoot = await makeScriptRoot([
      "EMAIL_PROVIDER_SMTP_HOST=smtp.env.example",
      "EMAIL_PROVIDER_SMTP_PORT=not-a-number",
      "EMAIL_PROVIDER_SMTP_USERNAME=env-user",
      "EMAIL_PROVIDER_SMTP_PASSWORD=env-pass",
      "EMAIL_PROVIDER_SMTP_USE_SSL=maybe",
    ]);

    await expect(loadConfig(envConfigCommand, scriptRoot)).rejects.toThrow(
      /EMAIL_PROVIDER_SMTP_PORT must be an integer.*EMAIL_PROVIDER_SMTP_USE_SSL must be true or false/,
    );
  });

  it("rejects an out-of-range port from the env file", async () => {
    const scriptRoot = await makeScriptRoot([
      "EMAIL_PROVIDER_SMTP_HOST=smtp.env.example",
      "EMAIL_PROVIDER_SMTP_PORT=99999",
      "EMAIL_PROVIDER_SMTP_USERNAME=env-user",
      "EMAIL_PROVIDER_SMTP_PASSWORD=env-pass",
      "EMAIL_PROVIDER_SMTP_USE_SSL=true",
    ]);

    await expect(loadConfig(envConfigCommand, scriptRoot)).rejects.toThrow(
      /EMAIL_PROVIDER_SMTP_PORT must be between 1 and 65535/,
    );
  });

  it("rejects when the .env sample contract is broken", async () => {
    const scriptRoot = await mkdtemp(join(tmpdir(), "verify-smtp-config-"));
    createdDirs.push(scriptRoot);
    await writeFile(join(scriptRoot, ".env.sample"), "UNKNOWN_KEY=");
    await writeFile(join(scriptRoot, ".env"), "");

    await expect(loadConfig(envConfigCommand, scriptRoot)).rejects.toThrow(
      /Invalid verify-smtp env contract/,
    );
  });
});
