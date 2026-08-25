import { rmSync } from "node:fs";
import { Readable } from "node:stream";
import type { Archiver } from "archiver";
import type pino from "pino";

export function safeFilename(filename: string): string {
  return filename.replace(/[/\\]/g, "_");
}

export function nodeReadableFromWebStream(
  webStream: ReadableStream<Uint8Array>,
): Readable {
  return Readable.from(webStream as AsyncIterable<Uint8Array>);
}

export function toNdjson(rows: unknown[]): string {
  if (rows.length === 0) {
    return "";
  }

  return `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
}

export function extractBoundary(contentType: string): string | null {
  const match = contentType.match(/boundary=([^\s;]+)/);
  return match ? match[1] : null;
}

export function extractFilename(
  header: Record<string, string[]>,
): string | null {
  const disposition = header["content-disposition"]?.[0];
  if (!disposition) {
    return null;
  }

  const match = disposition.match(/filename="([^"]+)"/);
  return match ? match[1] : null;
}

export function isStreamTerminationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalizedMessage = error.message.toLowerCase();
  return normalizedMessage.includes("terminated");
}

export function cleanupZipFile(filePath: string, logger: pino.Logger): void {
  try {
    rmSync(filePath, { force: true });
    logger.info({ filePath }, "[Export Data SDK] Cleaned up zip file");
  } catch (cleanupError) {
    logger.warn(
      { cleanupError, filePath },
      "[Export Data SDK] Failed to cleanup partial export file",
    );
  }
}

export function logZipSize(params: {
  zip: Archiver;
  logger: pino.Logger;
  logParams?: Record<string, string | number | boolean>;
}): void {
  const { zip, logger, logParams } = params;
  const sizeKB = zip.pointer() / 1024;
  logger.info(
    { ...logParams, sizeKB },
    `[Export Data SDK] Current Archive size`,
  );
}
