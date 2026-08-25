import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  isHeartbeatStale,
  writeHeartbeat,
} from "~/scripts/lifecycle-worker/heartbeat.js";

describe("isHeartbeatStale", () => {
  const now = 1_000_000;
  const maxStalenessMs = 1000;

  it("treats a recent heartbeat as fresh", () => {
    expect(isHeartbeatStale(String(now - 500), now, maxStalenessMs)).toBe(
      false,
    );
  });

  it("treats a heartbeat exactly at the threshold as fresh", () => {
    expect(
      isHeartbeatStale(String(now - maxStalenessMs), now, maxStalenessMs),
    ).toBe(false);
  });

  it("treats an old heartbeat as stale", () => {
    expect(isHeartbeatStale(String(now - 5000), now, maxStalenessMs)).toBe(
      true,
    );
  });

  it("treats missing or empty contents as stale", () => {
    expect(isHeartbeatStale(undefined, now, maxStalenessMs)).toBe(true);
    expect(isHeartbeatStale(null, now, maxStalenessMs)).toBe(true);
    expect(isHeartbeatStale("", now, maxStalenessMs)).toBe(true);
  });

  it("treats non-numeric contents as stale", () => {
    expect(isHeartbeatStale("not-a-number", now, maxStalenessMs)).toBe(true);
  });
});

describe("writeHeartbeat", () => {
  const dir = mkdtempSync(join(tmpdir(), "lifecycle-worker-hb-"));

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes the provided timestamp to the file", () => {
    const file = join(dir, "beat");
    writeHeartbeat(file, 123456);
    expect(readFileSync(file, "utf8")).toBe("123456");
  });

  it("does not throw when the path is not writable", () => {
    expect(() =>
      writeHeartbeat("/this/path/does/not/exist/beat", 1),
    ).not.toThrow();
  });
});
