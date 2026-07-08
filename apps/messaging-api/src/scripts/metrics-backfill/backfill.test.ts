import { afterEach, describe, expect, it, vi } from "vitest";
import type { EnvDbConfig } from "../../plugins/external/env.js";
import type { DailyCount } from "./utils.js";

const originalEnv = { ...process.env };
const params = {
  envDbConfig: {} as EnvDbConfig,
  remoteWriteEndpoint: "http://localhost:4318/write",
};

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
}

async function importBackfillWithConnectTrap() {
  vi.resetModules();
  vi.doMock("./utils.js", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./utils.js")>();
    return {
      ...actual,
      connectToDatabase: vi.fn(() => {
        throw new Error("connectToDatabase called");
      }),
    };
  });
  return import("./backfill.js");
}

async function importBackfillWithRows(rows: DailyCount[]) {
  const logger = {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };
  const pool = { end: vi.fn() };
  const postWithRetry = vi.fn();

  vi.resetModules();
  vi.doMock("pino", () => ({
    default: { pino: () => logger },
  }));
  vi.doMock("close-with-grace", () => ({ default: vi.fn() }));
  vi.doMock("./utils.js", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./utils.js")>();
    return {
      ...actual,
      connectToDatabase: vi.fn(async () => pool),
      createCollectorTokenProvider: vi.fn(() => async () => undefined),
      fetchDailyCounts: vi.fn(async () => rows),
      postWithRetry,
      sleep: vi.fn(async () => undefined),
    };
  });

  return {
    ...(await import("./backfill.js")),
    logger,
    postWithRetry,
  };
}

afterEach(() => {
  vi.doUnmock("close-with-grace");
  vi.doUnmock("pino");
  vi.doUnmock("./utils.js");
  vi.resetModules();
  restoreEnv();
});

describe("metrics backfill config", () => {
  it("ignores the generic DRY_RUN env var", async () => {
    process.env.DRY_RUN = "false";
    delete process.env.METRICS_BACKFILL_DRY_RUN;

    vi.resetModules();
    const { DRY_RUN } = await import("./constants.js");

    expect(DRY_RUN).toBe(true);
  });

  it("only disables dry-run via METRICS_BACKFILL_DRY_RUN=false", async () => {
    process.env.METRICS_BACKFILL_DRY_RUN = "false";

    vi.resetModules();
    const { DRY_RUN } = await import("./constants.js");

    expect(DRY_RUN).toBe(false);
  });

  it("requires METRICS_BACKFILL_NAMESPACE", async () => {
    delete process.env.METRICS_BACKFILL_NAMESPACE;
    process.env.METRICS_BACKFILL_CLUSTER = "non-prod-02";
    const { runBackfill } = await importBackfillWithConnectTrap();

    await expect(runBackfill(params)).rejects.toThrow(
      "METRICS_BACKFILL_NAMESPACE missing",
    );
  });

  it("requires METRICS_BACKFILL_CLUSTER", async () => {
    process.env.METRICS_BACKFILL_NAMESPACE = "messaging-api-dev";
    delete process.env.METRICS_BACKFILL_CLUSTER;
    const { runBackfill } = await importBackfillWithConnectTrap();

    await expect(runBackfill(params)).rejects.toThrow(
      "METRICS_BACKFILL_CLUSTER missing",
    );
  });

  it("logs dry-run summaries without posting", async () => {
    delete process.env.METRICS_BACKFILL_DRY_RUN;
    process.env.METRICS_BACKFILL_NAMESPACE = "messaging-api-dev";
    process.env.METRICS_BACKFILL_CLUSTER = "non-prod-02";
    const { logger, postWithRetry, runBackfill } = await importBackfillWithRows(
      [
        {
          organizationId: "acp",
          day: new Date("2026-01-15T00:00:00.000Z"),
          counter: 5,
          cumulative: 42,
        },
      ],
    );

    await runBackfill(params);

    expect(postWithRetry).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        dryRun: true,
        series: [
          expect.objectContaining({
            cumulative: 42,
            daily: 5,
            organizationId: "acp",
          }),
        ],
      }),
      "Would remote-write daily payload",
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true, lastCompletedDay: "2026-01-15" }),
      "Backfill dry run complete",
    );
  });
});
