import { readFile } from "node:fs/promises";

export interface CsvRecipientRow {
  csvRowNumber: number;
  rawEmail: string;
  normalizedEmail: string;
}

export async function readRecipientCsv(
  filePath: string,
): Promise<CsvRecipientRow[]> {
  const content = await readFile(filePath, "utf8");
  const lines = content.split(/\r?\n/).filter((line) => line.length > 0);

  if (lines[0] !== "email") {
    throw new Error("Recipient CSV must contain an exact email header");
  }

  return lines.slice(1).map((line, index) => {
    const rawEmail = line.trim();

    return {
      csvRowNumber: index + 1,
      rawEmail,
      normalizedEmail: rawEmail.toLowerCase(),
    };
  });
}
