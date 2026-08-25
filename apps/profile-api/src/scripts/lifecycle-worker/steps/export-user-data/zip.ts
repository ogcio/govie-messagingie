import { pipeline } from "node:stream/promises";
import { Dicer } from "@fastify/busboy";
import type { ZipArchive } from "archiver";
import type pino from "pino";
import { getStreamIdleTimeoutMs } from "../../config.js";
import {
  extractFilename,
  isStreamTerminationError,
  nodeReadableFromWebStream,
  safeFilename,
  toNdjson,
} from "./utils.js";

export function appendStructuredDataToZip(params: {
  zip: ZipArchive;
  profileIds: string[];
  profileDataById: Map<string, unknown>;
  messagesByUserId: Record<string, unknown[]>;
}): void {
  const { zip, profileIds, profileDataById, messagesByUserId } = params;

  for (const targetProfileId of profileIds) {
    const profileData = profileDataById.get(targetProfileId);
    const messages = messagesByUserId[targetProfileId] ?? [];

    zip.append(toNdjson(profileData ? [profileData] : []), {
      name: `${targetProfileId}/profile.ndjson`,
    });

    if (messages.length > 0) {
      zip.append(toNdjson(messages), {
        name: `${targetProfileId}/messages.ndjson`,
      });
    }
  }
}

export async function appendMultipartStreamToZip(params: {
  userId: string;
  chunk: { data: unknown; boundary: string };
  zip: ZipArchive;
  logger: pino.Logger;
}): Promise<void> {
  const { userId, chunk, zip, logger } = params;
  const nodeStream = nodeReadableFromWebStream(
    chunk.data as ReadableStream<Uint8Array>,
  );

  let partCount = 0;

  await new Promise<void>((resolve, reject) => {
    const dicer = new Dicer({ boundary: chunk.boundary });
    let parsingFinished = false;
    let settled = false;
    const partPromises: Promise<void>[] = [];

    // Inactivity watchdog: a stalled upstream connection (headers received but
    // the body never completes) would otherwise leave this promise pending
    // forever and wedge the single-flight worker loop. Reset on every byte.
    const idleTimeoutMs = getStreamIdleTimeoutMs();
    let idleTimer: NodeJS.Timeout | undefined;
    const clearIdleTimer = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = undefined;
      }
    };
    const armIdleTimer = () => {
      clearIdleTimer();
      idleTimer = setTimeout(() => {
        const error = new Error(
          `Multipart download stalled: no data received for ${idleTimeoutMs}ms`,
        );
        logger.error({ userId, idleTimeoutMs }, error.message);
        nodeStream.destroy(error);
        rejectOnce(error);
      }, idleTimeoutMs);
      idleTimer.unref?.();
    };

    const resolveOnce = () => {
      if (settled) {
        return;
      }

      settled = true;
      clearIdleTimer();
      resolve();
    };

    const rejectOnce = (error: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearIdleTimer();
      reject(error);
    };

    armIdleTimer();

    const settleAllParts = () => {
      Promise.allSettled(partPromises).then(() => {
        logger.info(
          { userId, totalFiles: partCount },
          "[Export Data SDK] All parts buffered and appended to zip",
        );
        resolveOnce();
      });
    };

    dicer.on("part", (part: Dicer.PartStream) => {
      armIdleTimer();
      const partNumber = partCount++;

      const partPromise = new Promise<void>((resolvePart, rejectPart) => {
        part.on("header", (header: Record<string, string[]>) => {
          const rawName = extractFilename(header);
          const filename = rawName
            ? safeFilename(rawName)
            : `unknown-${partNumber}`;

          const buffers: Buffer[] = [];
          part.on("data", (data: Buffer) => {
            armIdleTimer();
            buffers.push(data);
          });
          part.on("end", () => {
            const buffer = Buffer.concat(buffers);
            logger.info(
              {
                userId,
                filename,
                partIndex: partNumber,
                size: buffer.length,
              },
              "[Export Data SDK] Appending buffered file to zip",
            );
            zip.append(buffer, {
              name: `${userId}/files/${filename}`,
            });
            resolvePart();
          });
        });

        part.on("error", (err: Error) => {
          logger.error(
            {
              error: err,
              userId,
              partIndex: partNumber,
            },
            "[Export Data SDK] Error reading part",
          );
          rejectPart(err);
        });
      });

      partPromises.push(partPromise);
    });

    dicer.on("finish", () => {
      parsingFinished = true;
      logger.info(
        { userId, totalFiles: partCount },
        "[Export Data SDK] Multipart parsing complete",
      );
      settleAllParts();
    });

    dicer.on("error", (err: Error) => {
      if (isStreamTerminationError(err) && (parsingFinished || partCount > 0)) {
        logger.warn(
          { error: err, userId, partIndex: partCount },
          "[Export Data SDK] Ignoring stream termination during multipart parsing",
        );
        settleAllParts();
        return;
      }

      logger.error(
        {
          error: {
            message: err.message,
            stack: err.stack,
            name: err.name,
            cause: err.cause,
          },
          userId,
        },
        "[Export Data SDK] Dicer parsing error",
      );
      rejectOnce(err);
    });

    pipeline(nodeStream, dicer).catch((err: Error) => {
      if (isStreamTerminationError(err) && (parsingFinished || partCount > 0)) {
        logger.warn(
          { error: err, userId, partIndex: partCount },
          "[Export Data SDK] Ignoring stream termination during multipart parsing",
        );
        settleAllParts();
        return;
      }

      rejectOnce(err);
    });
  });
}
