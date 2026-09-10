import type { ZipArchive } from "archiver";
import pino from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { appendMultipartStreamToZip } from "~/scripts/lifecycle-worker/steps/export-user-data/zip.js";

const logger = pino({ enabled: false });
const BOUNDARY = "test-boundary";

const buildMultipartBody = (
  parts: { filename?: string; content: string }[],
): string => {
  const chunks = parts.map((part) => {
    const disposition = part.filename
      ? `Content-Disposition: form-data; name="file"; filename="${part.filename}"`
      : `Content-Disposition: form-data; name="file"`;
    return `--${BOUNDARY}\r\n${disposition}\r\n\r\n${part.content}\r\n`;
  });
  return `${chunks.join("")}--${BOUNDARY}--\r\n`;
};

const webStreamFromString = (body: string): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body));
      controller.close();
    },
  });

describe("appendMultipartStreamToZip", () => {
  const append = vi.fn();
  const zip = { append } as unknown as ZipArchive;

  beforeEach(() => {
    append.mockClear();
  });

  it("appends each part to the zip under the user's files folder", async () => {
    const body = buildMultipartBody([
      { filename: "report.pdf", content: "pdf-bytes" },
      { filename: "photo.png", content: "png-bytes" },
    ]);

    await appendMultipartStreamToZip({
      userId: "u1",
      chunk: { data: webStreamFromString(body), boundary: BOUNDARY },
      zip,
      logger,
    });

    expect(append).toHaveBeenCalledTimes(2);
    expect(append).toHaveBeenCalledWith(Buffer.from("pdf-bytes"), {
      name: "u1/files/report.pdf",
    });
    expect(append).toHaveBeenCalledWith(Buffer.from("png-bytes"), {
      name: "u1/files/photo.png",
    });
  });

  it("sanitizes path separators in filenames", async () => {
    const body = buildMultipartBody([
      { filename: "../etc/passwd", content: "x" },
    ]);

    await appendMultipartStreamToZip({
      userId: "u1",
      chunk: { data: webStreamFromString(body), boundary: BOUNDARY },
      zip,
      logger,
    });

    expect(append).toHaveBeenCalledWith(Buffer.from("x"), {
      name: "u1/files/.._etc_passwd",
    });
  });

  it("falls back to an indexed name when the filename is missing", async () => {
    const body = buildMultipartBody([{ content: "anonymous" }]);

    await appendMultipartStreamToZip({
      userId: "u1",
      chunk: { data: webStreamFromString(body), boundary: BOUNDARY },
      zip,
      logger,
    });

    expect(append).toHaveBeenCalledWith(Buffer.from("anonymous"), {
      name: "u1/files/unknown-0",
    });
  });

  it("handles an empty multipart payload", async () => {
    const body = `--${BOUNDARY}--\r\n`;

    await appendMultipartStreamToZip({
      userId: "u1",
      chunk: { data: webStreamFromString(body), boundary: BOUNDARY },
      zip,
      logger,
    });

    expect(append).not.toHaveBeenCalled();
  });

  it("rejects when the upstream stream errors mid-flight", async () => {
    const failingStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(`--${BOUNDARY}\r\n`));
        controller.error(new Error("upstream reset"));
      },
    });

    await expect(
      appendMultipartStreamToZip({
        userId: "u1",
        chunk: { data: failingStream, boundary: BOUNDARY },
        zip,
        logger,
      }),
    ).rejects.toThrow("upstream reset");
  });

  it("ignores a terminated-stream error after parsing finished", async () => {
    // 'terminated' errors thrown after all parts arrived are tolerated (the
    // upstream closed the keep-alive early); content must still be appended.
    const body = buildMultipartBody([{ filename: "ok.txt", content: "done" }]);
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls++;
        if (pulls === 1) {
          controller.enqueue(new TextEncoder().encode(body));
        } else {
          // Error only after the full body was delivered and parsed.
          controller.error(new Error("terminated"));
        }
      },
    });

    await appendMultipartStreamToZip({
      userId: "u1",
      chunk: { data: stream, boundary: BOUNDARY },
      zip,
      logger,
    });

    expect(append).toHaveBeenCalledWith(Buffer.from("done"), {
      name: "u1/files/ok.txt",
    });
  });

  it("rejects when the download stalls past the idle timeout", async () => {
    process.env.WORKER_STREAM_IDLE_TIMEOUT_SECONDS = "1";
    try {
      const stalledStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(`--${BOUNDARY}\r\n`));
          // never close, never enqueue again
        },
      });

      await expect(
        appendMultipartStreamToZip({
          userId: "u1",
          chunk: { data: stalledStream, boundary: BOUNDARY },
          zip,
          logger,
        }),
      ).rejects.toThrow("Multipart download stalled");
    } finally {
      delete process.env.WORKER_STREAM_IDLE_TIMEOUT_SECONDS;
    }
  }, 15000);
});
