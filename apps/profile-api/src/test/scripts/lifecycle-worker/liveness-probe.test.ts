import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const dir = mkdtempSync(join(tmpdir(), "liveness-probe-"));
const heartbeatFile = join(dir, "heartbeat");

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

// The probe is a run-at-import script that ends in process.exit either way;
// stub exit to capture the code and stop execution via a sentinel throw.
class ExitSentinel extends Error {
  constructor(readonly code: number) {
    super(`exit ${code}`);
  }
}

const runProbe = async (): Promise<number> => {
  vi.resetModules();
  const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
    code: number,
  ) => {
    throw new ExitSentinel(code);
  }) as never);
  const stderrSpy = vi
    .spyOn(process.stderr, "write")
    .mockImplementation(() => true);
  try {
    await import("~/scripts/lifecycle-worker/liveness-probe.js");
    throw new Error("probe did not exit");
  } catch (error) {
    if (error instanceof ExitSentinel) {
      return error.code;
    }
    throw error;
  } finally {
    exitSpy.mockRestore();
    stderrSpy.mockRestore();
  }
};

describe("liveness-probe", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    process.env.WORKER_HEARTBEAT_FILE = heartbeatFile;
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("exits 0 when the heartbeat is fresh", async () => {
    writeFileSync(heartbeatFile, String(Date.now()));
    await expect(runProbe()).resolves.toBe(0);
  });

  it("exits 1 when the heartbeat is stale", async () => {
    writeFileSync(heartbeatFile, String(Date.now() - 100 * 60 * 60 * 1000));
    await expect(runProbe()).resolves.toBe(1);
  });

  it("exits 1 when the heartbeat file is missing", async () => {
    rmSync(heartbeatFile, { force: true });
    await expect(runProbe()).resolves.toBe(1);
  });
});
