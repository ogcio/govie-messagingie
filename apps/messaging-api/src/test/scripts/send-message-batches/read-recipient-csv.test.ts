import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readRecipientCsv } from "../../../scripts/send-message-batches/csv/read-recipient-csv.js";

const createdDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    createdDirs
      .splice(0)
      .map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("readRecipientCsv", () => {
  it("normalizes emails and preserves row numbers", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "send-message-batches-csv-"));
    createdDirs.push(baseDir);

    const filePath = join(baseDir, "recipients.csv");
    await writeFile(filePath, "email\n ONE@example.com \nTwo@example.com\n");

    await expect(readRecipientCsv(filePath)).resolves.toEqual([
      {
        csvRowNumber: 1,
        rawEmail: "ONE@example.com",
        normalizedEmail: "one@example.com",
      },
      {
        csvRowNumber: 2,
        rawEmail: "Two@example.com",
        normalizedEmail: "two@example.com",
      },
    ]);
  });

  it("rejects CSV files without the email header", async () => {
    const baseDir = await mkdtemp(
      join(tmpdir(), "send-message-batches-csv-bad-"),
    );
    createdDirs.push(baseDir);

    const filePath = join(baseDir, "recipients.csv");
    await writeFile(filePath, "userEmail\none@example.com\n");

    await expect(readRecipientCsv(filePath)).rejects.toThrowError(
      /email header/,
    );
  });
});
