import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseCliArgs } from "../../../scripts/send-message-batches/cli.js";
import { loadConfig } from "../../../scripts/send-message-batches/config/load-config.js";

const createdDirs: string[] = [];

async function makeScriptRoot() {
  const scriptRoot = await mkdtemp(
    join(tmpdir(), "send-message-batches-config-"),
  );
  createdDirs.push(scriptRoot);

  await writeFile(
    join(scriptRoot, ".env.sample"),
    [
      "POSTGRES_USER=",
      "POSTGRES_PASSWORD=",
      "POSTGRES_HOST=",
      "POSTGRES_PORT=",
      "POSTGRES_DB_NAME=",
      "LOGTO_OIDC_ENDPOINT=",
      "PUBLIC_SERVANT_CLIENT_ID=",
      "PUBLIC_SERVANT_CLIENT_SECRET=",
      "PUBLIC_SERVANT_ORGANIZATION_ID=",
      "PUBLIC_SERVANT_SCOPES=",
      "PROFILE_BACKEND_URL=",
      "MESSAGING_BACKEND_URL=",
      "RECIPIENTS_CSV_PATH=",
      "HTML_TEMPLATE_PATH=",
      "TXT_TEMPLATE_PATH=",
      "MESSAGE_SUBJECT=",
      "SEND_BATCH_SIZE=",
      "SEND_BATCH_DELAY_MS=",
      "EVENT_SYNC_DELAY_SECONDS=",
    ].join("\n"),
  );

  const recipientsPath = join(scriptRoot, "recipients.csv");
  const htmlTemplatePath = join(scriptRoot, "message.html");
  const txtTemplatePath = join(scriptRoot, "message.txt");

  await writeFile(recipientsPath, "email\none@example.com\n");
  await writeFile(htmlTemplatePath, "<p>Hello {{publicName}}</p>");
  await writeFile(txtTemplatePath, "Hello {{publicName}}\n");

  return {
    scriptRoot,
    env: {
      POSTGRES_USER: "postgres",
      POSTGRES_PASSWORD: "postgres",
      POSTGRES_HOST: "localhost",
      POSTGRES_PORT: "5432",
      POSTGRES_DB_NAME: "messaging_send_message_batches",
      LOGTO_OIDC_ENDPOINT: "https://logto.example/oidc",
      PUBLIC_SERVANT_CLIENT_ID: "client-id",
      PUBLIC_SERVANT_CLIENT_SECRET: "client-secret",
      PUBLIC_SERVANT_ORGANIZATION_ID: "org-1",
      PUBLIC_SERVANT_SCOPES:
        "profile:user:read messaging:message:* messaging:event:read",
      PROFILE_BACKEND_URL: "https://profile.example",
      MESSAGING_BACKEND_URL: "https://messaging.example",
      RECIPIENTS_CSV_PATH: recipientsPath,
      HTML_TEMPLATE_PATH: htmlTemplatePath,
      TXT_TEMPLATE_PATH: txtTemplatePath,
      MESSAGE_SUBJECT: "Wallet pilot",
      SEND_BATCH_SIZE: "50",
      SEND_BATCH_DELAY_MS: "250",
      EVENT_SYNC_DELAY_SECONDS: "1800",
    },
  };
}

afterEach(async () => {
  await Promise.all(
    createdDirs
      .splice(0)
      .map((dirPath) => rm(dirPath, { recursive: true, force: true })),
  );
});

describe("parseCliArgs", () => {
  const runId = "11111111-1111-4111-8111-111111111111";

  it("defaults to the run command", () => {
    expect(parseCliArgs([])).toEqual({
      kind: "run",
      forceNew: false,
      sendAt: undefined,
      eventSyncDelaySeconds: undefined,
    });
  });

  it("parses the status command with run targeting", () => {
    expect(parseCliArgs(["status", "--run-id", runId])).toEqual({
      kind: "status",
      runId,
      sendAt: undefined,
    });
  });

  it("rejects non-integer event sync overrides", () => {
    expect(() =>
      parseCliArgs(["--event-sync-delay-seconds", "900ms"]),
    ).toThrowError(/Expected an integer/);
  });

  it("rejects invalid status run ids", () => {
    expect(() => parseCliArgs(["status", "--run-id", "run-123"])).toThrowError(
      /Expected a UUID/,
    );
  });
});

describe("loadConfig", () => {
  it("aggregates missing and invalid env problems", async () => {
    const { scriptRoot, env } = await makeScriptRoot();

    const invalidLoad = loadConfig({
      env: {
        ...env,
        POSTGRES_PORT: "abc",
        TXT_TEMPLATE_PATH: "",
      },
      cli: parseCliArgs([]),
      scriptRoot,
    });

    await expect(invalidLoad).rejects.toThrowError(/POSTGRES_PORT/);
    await expect(invalidLoad).rejects.toThrowError(/TXT_TEMPLATE_PATH/);
  });

  it("validates files and applies the CLI sync override", async () => {
    const { scriptRoot, env } = await makeScriptRoot();

    const config = await loadConfig({
      env,
      cli: parseCliArgs(["--event-sync-delay-seconds", "900", "--force-new"]),
      scriptRoot,
    });

    expect(config.command).toEqual({
      kind: "run",
      forceNew: true,
      sendAt: undefined,
      eventSyncDelaySeconds: 900,
    });
    expect(config.logtoOidcEndpoint).toBe("https://logto.example/oidc/");
    expect(config.eventSyncDelaySeconds).toBe(1800);
  });

  it("rejects env integers with trailing junk", async () => {
    const { scriptRoot, env } = await makeScriptRoot();

    await expect(
      loadConfig({
        env: {
          ...env,
          POSTGRES_PORT: "5432abc",
        },
        cli: parseCliArgs([]),
        scriptRoot,
      }),
    ).rejects.toThrowError(/POSTGRES_PORT/);
  });

  it("rejects non-iso sendAt values from the CLI contract", async () => {
    const { scriptRoot, env } = await makeScriptRoot();

    await expect(
      loadConfig({
        env,
        cli: parseCliArgs(["--send-at", "May 27 2026 09:00"]),
        scriptRoot,
      }),
    ).rejects.toThrowError(/--send-at/);
  });

  it("reports an unreadable recipients csv only once", async () => {
    const { scriptRoot, env } = await makeScriptRoot();

    try {
      await loadConfig({
        env: {
          ...env,
          RECIPIENTS_CSV_PATH: join(scriptRoot, "missing.csv"),
        },
        cli: parseCliArgs([]),
        scriptRoot,
      });
      throw new Error(
        "Expected loadConfig to reject unreadable RECIPIENTS_CSV_PATH",
      );
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }

      expect(error.message.match(/RECIPIENTS_CSV_PATH/g)).toHaveLength(1);
    }
  });

  it("rejects directory paths for templates", async () => {
    const { scriptRoot, env } = await makeScriptRoot();
    const directoryTemplatePath = join(scriptRoot, "template-directory");

    await mkdir(directoryTemplatePath);

    await expect(
      loadConfig({
        env: {
          ...env,
          HTML_TEMPLATE_PATH: directoryTemplatePath,
        },
        cli: parseCliArgs([]),
        scriptRoot,
      }),
    ).rejects.toThrowError(/HTML_TEMPLATE_PATH/);
  });

  it("allows status runId lookups without fingerprint input validation", async () => {
    const { scriptRoot, env } = await makeScriptRoot();
    const runId = "11111111-1111-4111-8111-111111111111";

    const config = await loadConfig({
      env: {
        ...env,
        RECIPIENTS_CSV_PATH: join(scriptRoot, "missing.csv"),
        HTML_TEMPLATE_PATH: join(scriptRoot, "missing.html"),
        TXT_TEMPLATE_PATH: join(scriptRoot, "missing.txt"),
      },
      cli: parseCliArgs([
        "status",
        "--run-id",
        runId,
        "--send-at",
        "not-an-iso-timestamp",
      ]),
      scriptRoot,
    });

    expect(config.command).toEqual({
      kind: "status",
      runId,
      sendAt: "not-an-iso-timestamp",
    });
  });
});
