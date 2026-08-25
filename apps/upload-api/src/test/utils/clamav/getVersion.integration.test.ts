/**
 * Integration tests for ClamAV getVersion against a real clamd daemon.
 *
 * These tests require a running ClamAV container:
 *   docker compose up clamav
 *
 * Run with:
 *   pnpm test:integration:clamav
 *
 * NOT included in normal CI test runs.
 */
import { describe, expect, it } from "vitest";
import { getVersion } from "../../../utils/clamav/getVersion.js";

const CLAMAV_HOST = process.env.CLAMAV_HOST || "127.0.0.1";
const CLAMAV_PORT = Number(process.env.CLAMAV_PORT) || 3310;

const connectionOpts = {
  host: CLAMAV_HOST,
  port: CLAMAV_PORT,
  connectionTimeout: 10_000,
};

describe("ClamAV getVersion Integration Tests", () => {
  it("returns a version string from clamd", async () => {
    const version = await getVersion(connectionOpts);

    expect(version).toBeTruthy();
    expect(typeof version).toBe("string");
    // ClamAV version format: "ClamAV X.Y.Z/NNNNN/Day Mon DD HH:MM:SS YYYY"
    expect(version).toMatch(/^ClamAV\s+\d+\.\d+\.\d+\/\d+\//);
  });

  it("contains a database version number", async () => {
    const version = await getVersion(connectionOpts);

    const dbVersionMatch = version.match(/\/(\d+)\//);
    expect(dbVersionMatch).not.toBeNull();

    const dbVersion = Number(dbVersionMatch?.[1]);
    expect(dbVersion).toBeGreaterThan(0);
  });

  it("rejects on connection timeout for unreachable host", async () => {
    await expect(
      getVersion({
        host: "192.0.2.1", // RFC 5737 TEST-NET, guaranteed unreachable
        port: CLAMAV_PORT,
        connectionTimeout: 500,
      }),
    ).rejects.toThrow("Connection timeout");
  });

  it("rejects on connection refused for wrong port", async () => {
    await expect(
      getVersion({
        host: CLAMAV_HOST,
        port: 19999, // unlikely to be open
        connectionTimeout: 2_000,
      }),
    ).rejects.toThrow();
  });
});
