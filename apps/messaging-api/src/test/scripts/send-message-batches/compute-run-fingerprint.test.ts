import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { computeRunFingerprint } from "../../../scripts/send-message-batches/config/compute-run-fingerprint.js";
import { resolveSendAt } from "../../../scripts/send-message-batches/config/resolve-send-at.js";

const createdDirs: string[] = [];

async function makeInputs() {
  const baseDir = await mkdtemp(
    join(tmpdir(), "send-message-batches-fingerprint-"),
  );
  createdDirs.push(baseDir);

  const recipientsCsvPath = join(baseDir, "recipients.csv");
  const htmlTemplatePath = join(baseDir, "message.html");
  const txtTemplatePath = join(baseDir, "message.txt");

  await writeFile(recipientsCsvPath, "email\none@example.com\n");
  await writeFile(htmlTemplatePath, "<p>Hello</p>");
  await writeFile(txtTemplatePath, "Hello\n");

  return {
    recipientsCsvPath,
    htmlTemplatePath,
    txtTemplatePath,
  };
}

afterEach(async () => {
  await Promise.all(
    createdDirs
      .splice(0)
      .map((dirPath) => rm(dirPath, { recursive: true, force: true })),
  );
});

describe("computeRunFingerprint", () => {
  it("is stable for immediate mode across different now values", async () => {
    const inputs = await makeInputs();

    const immediateOne = await computeRunFingerprint({
      organizationId: "org-1",
      recipientsCsvPath: inputs.recipientsCsvPath,
      htmlTemplatePath: inputs.htmlTemplatePath,
      txtTemplatePath: inputs.txtTemplatePath,
      messageSubject: "Wallet pilot",
      templateVariablesSchemaVersion: "v1",
      resolvedSendAt: resolveSendAt({
        sendAt: undefined,
        now: new Date("2026-05-26T09:00:00.000Z"),
      }),
    });

    const immediateTwo = await computeRunFingerprint({
      organizationId: "org-1",
      recipientsCsvPath: inputs.recipientsCsvPath,
      htmlTemplatePath: inputs.htmlTemplatePath,
      txtTemplatePath: inputs.txtTemplatePath,
      messageSubject: "Wallet pilot",
      templateVariablesSchemaVersion: "v1",
      resolvedSendAt: resolveSendAt({
        sendAt: undefined,
        now: new Date("2026-05-26T12:45:00.000Z"),
      }),
    });

    expect(immediateOne.runFingerprint).toBe(immediateTwo.runFingerprint);
  });

  it("changes when the scheduled sendAt changes", async () => {
    const inputs = await makeInputs();

    const scheduledOne = await computeRunFingerprint({
      organizationId: "org-1",
      recipientsCsvPath: inputs.recipientsCsvPath,
      htmlTemplatePath: inputs.htmlTemplatePath,
      txtTemplatePath: inputs.txtTemplatePath,
      messageSubject: "Wallet pilot",
      templateVariablesSchemaVersion: "v1",
      resolvedSendAt: resolveSendAt({
        sendAt: "2026-05-27T09:00:00.000Z",
        now: new Date("2026-05-26T09:00:00.000Z"),
      }),
    });

    const scheduledTwo = await computeRunFingerprint({
      organizationId: "org-1",
      recipientsCsvPath: inputs.recipientsCsvPath,
      htmlTemplatePath: inputs.htmlTemplatePath,
      txtTemplatePath: inputs.txtTemplatePath,
      messageSubject: "Wallet pilot",
      templateVariablesSchemaVersion: "v1",
      resolvedSendAt: resolveSendAt({
        sendAt: "2026-05-28T09:00:00.000Z",
        now: new Date("2026-05-26T09:00:00.000Z"),
      }),
    });

    expect(scheduledOne.runFingerprint).not.toBe(scheduledTwo.runFingerprint);
  });

  it("rejects non-iso scheduled values", () => {
    expect(() =>
      resolveSendAt({
        sendAt: "May 27 2026 09:00",
        now: new Date("2026-05-26T09:00:00.000Z"),
      }),
    ).toThrowError(/ISO-8601/);
  });

  it("accepts ISO scheduled values without seconds", () => {
    const resolvedSendAt = resolveSendAt({
      sendAt: "2026-05-27T09:00Z",
      now: new Date("2026-05-26T09:00:00.000Z"),
    });

    expect(resolvedSendAt.sendAtValue?.toISOString()).toBe(
      "2026-05-27T09:00:00.000Z",
    );
    expect(resolvedSendAt.fingerprintValue).toBe(
      "scheduled:2026-05-27T09:00:00.000Z",
    );
  });
});
