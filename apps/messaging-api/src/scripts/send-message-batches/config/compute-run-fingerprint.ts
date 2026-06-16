import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { FingerprintInput, FingerprintResult } from "../domain/types.js";

export async function computeRunFingerprint(
  input: FingerprintInput,
): Promise<FingerprintResult> {
  const [csvContents, htmlContents, txtContents] = await Promise.all([
    readFile(input.recipientsCsvPath, "utf8"),
    readFile(input.htmlTemplatePath, "utf8"),
    readFile(input.txtTemplatePath, "utf8"),
  ]);

  const csvContentHash = computeSha256(csvContents);
  const htmlContentHash = computeSha256(htmlContents);
  const txtContentHash = computeSha256(txtContents);
  const runFingerprint = computeSha256(
    [
      input.organizationId,
      csvContentHash,
      htmlContentHash,
      txtContentHash,
      input.messageSubject,
      input.templateVariablesSchemaVersion,
      input.resolvedSendAt.fingerprintValue,
    ].join("\n"),
  );

  return {
    runFingerprint,
    csvContentHash,
    htmlContentHash,
    txtContentHash,
  };
}

function computeSha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
