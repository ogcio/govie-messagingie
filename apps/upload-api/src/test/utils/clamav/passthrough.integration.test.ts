/**
 * Integration tests for ClamavPassthrough against a real clamd daemon.
 *
 * These tests require a running ClamAV container:
 *   docker compose up clamav
 *
 * Run with:
 *   pnpm test:integration:clamav
 *
 * NOT included in normal CI test runs.
 */
import { PassThrough, pipeline, Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { ClamavPassthrough } from "../../../utils/clamav/passthrough.js";

const CLAMAV_HOST = process.env.CLAMAV_HOST || "127.0.0.1";
const CLAMAV_PORT = Number(process.env.CLAMAV_PORT) || 3310;

const EICAR_TEST_STRING =
  "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

const connectionOpts = {
  host: CLAMAV_HOST,
  port: CLAMAV_PORT,
  connectionTimeout: 10_000,
  scanTimeout: 30_000,
};

function collectScanComplete(
  passthrough: ClamavPassthrough,
): Promise<{ isInfected: boolean; viruses: string[] }> {
  return new Promise((resolve, reject) => {
    passthrough.once("scan-complete", resolve);
    passthrough.once("error", reject);
  });
}

describe("ClamavPassthrough Integration Tests", () => {
  it("passes clean data through and emits scan-complete with isInfected=false", async () => {
    const passthrough = new ClamavPassthrough(connectionOpts);
    const scanPromise = collectScanComplete(passthrough);

    const chunks: Buffer[] = [];
    passthrough.on("data", (chunk) => chunks.push(chunk));

    const source = Readable.from([
      Buffer.from("This is a perfectly clean file."),
    ]);
    source.pipe(passthrough);

    const result = await scanPromise;

    expect(result.isInfected).toBe(false);
    expect(result.viruses).toEqual([]);
    expect(Buffer.concat(chunks).toString()).toBe(
      "This is a perfectly clean file.",
    );
  });

  it("passes infected data through and emits scan-complete with isInfected=true", async () => {
    const passthrough = new ClamavPassthrough(connectionOpts);
    const scanPromise = collectScanComplete(passthrough);

    const chunks: Buffer[] = [];
    passthrough.on("data", (chunk) => chunks.push(chunk));

    const source = Readable.from([Buffer.from(EICAR_TEST_STRING)]);
    source.pipe(passthrough);

    const result = await scanPromise;

    expect(result.isInfected).toBe(true);
    expect(result.viruses.length).toBeGreaterThan(0);
    expect(result.viruses[0].toLowerCase()).toContain("eicar");
    // Data still flows through to downstream
    expect(Buffer.concat(chunks).toString()).toBe(EICAR_TEST_STRING);
  });

  it("works in a pipeline with downstream consumers", async () => {
    const passthrough = new ClamavPassthrough(connectionOpts);
    const scanPromise = collectScanComplete(passthrough);
    const output = new PassThrough();

    const outputChunks: Buffer[] = [];
    output.on("data", (chunk) => outputChunks.push(chunk));

    const content = "Safe content for pipeline test";
    const source = Readable.from([Buffer.from(content)]);

    await new Promise<void>((resolve, reject) => {
      pipeline(source, passthrough, output, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const result = await scanPromise;
    expect(result.isInfected).toBe(false);
    expect(Buffer.concat(outputChunks).toString()).toBe(content);
  });

  it("supports scan-only mode without emitting readable chunks", async () => {
    const passthrough = new ClamavPassthrough(connectionOpts, {
      emitReadable: false,
    });
    const scanPromise = collectScanComplete(passthrough);
    const onData = vi.fn();

    passthrough.on("data", onData);

    const source = Readable.from([
      Buffer.from("This is a perfectly clean file."),
    ]);
    source.pipe(passthrough);

    const result = await scanPromise;

    expect(result.isInfected).toBe(false);
    expect(result.viruses).toEqual([]);
    expect(onData).not.toHaveBeenCalled();
  });

  it("handles a large file streamed in chunks", async () => {
    const passthrough = new ClamavPassthrough({
      ...connectionOpts,
      chunkSize: 32 * 1024,
    });
    const scanPromise = collectScanComplete(passthrough);

    let totalBytes = 0;
    passthrough.on("data", (chunk: Buffer) => {
      totalBytes += chunk.length;
    });

    // Stream 1 MiB of clean data
    const chunkData = Buffer.alloc(64 * 1024, 0x41);
    const source = Readable.from(Array.from({ length: 16 }, () => chunkData));
    source.pipe(passthrough);

    const result = await scanPromise;

    expect(result.isInfected).toBe(false);
    expect(totalBytes).toBe(16 * 64 * 1024);
  });

  it("emits scan-complete with failed status on connection timeout", async () => {
    const passthrough = new ClamavPassthrough({
      host: "192.0.2.1", // RFC 5737 TEST-NET, guaranteed unreachable
      port: CLAMAV_PORT,
      connectionTimeout: 500,
      scanTimeout: 1_000,
    });

    const result = await collectScanComplete(passthrough);

    expect(result.isInfected).toBe(false);
    expect(result.viruses).toEqual([]);
  });
});
