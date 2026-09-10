import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getPendingJobPerOrganization = vi.fn();
const record = vi.fn();
const logger = {
  info: vi.fn(),
  fatal: vi.fn(),
};

let shutdownHandler:
  | ((params: { signal?: string }) => Promise<void>)
  | undefined;
const closeWithGrace = vi.fn(
  (_opts: unknown, handler: (params: { signal?: string }) => Promise<void>) => {
    shutdownHandler = handler;
  },
);

vi.mock("close-with-grace", () => ({
  default: (...args: Parameters<typeof closeWithGrace>) =>
    closeWithGrace(...args),
}));
vi.mock("pino", () => {
  const pinoFn = () => logger;
  pinoFn.pino = pinoFn;
  return { default: pinoFn, pino: pinoFn };
});
vi.mock("../../../services/jobs/job-service.js", () => ({
  getPendingJobPerOrganization: (...args: unknown[]) =>
    getPendingJobPerOrganization(...args),
}));
vi.mock("../../../utils/metrics.js", () => ({
  messagesQueueGauge: { record: (...args: unknown[]) => record(...args) },
}));

const { startWorkerLoop } = await import(
  "../../../scripts/metrics-exporter/worker-loop.js"
);

beforeEach(() => {
  vi.clearAllMocks();
  shutdownHandler = undefined;
  process.env.METRICS_EXPORTER_INTERVAL_SECONDS = "60";
});

afterEach(() => {
  delete process.env.METRICS_EXPORTER_INTERVAL_SECONDS;
});

function makePool(queryImpl?: () => Promise<unknown>) {
  return {
    query: vi.fn(queryImpl ?? (async () => ({ rows: [] }))),
    end: vi.fn().mockResolvedValue(undefined),
  };
}

describe("startWorkerLoop", () => {
  it("records a gauge per organization and stops on shutdown", async () => {
    const pool = makePool();
    getPendingJobPerOrganization.mockImplementation(async () => {
      // Simulate a shutdown signal arriving during the first iteration so the
      // loop exits before sleeping.
      await shutdownHandler?.({ signal: "SIGTERM" });
      return [
        { counter: 3, organizationId: "org-1" },
        { counter: 1, organizationId: "org-2" },
      ];
    });

    await startWorkerLoop({ pool: pool as never });

    expect(pool.query).toHaveBeenCalledWith("SELECT 1");
    expect(getPendingJobPerOrganization).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(3, { organizationId: "org-1" });
    expect(record).toHaveBeenCalledWith(1, { organizationId: "org-2" });
    expect(pool.end).toHaveBeenCalledOnce();
  });

  it("rejects an invalid interval configuration", async () => {
    process.env.METRICS_EXPORTER_INTERVAL_SECONDS = "0";

    await expect(
      startWorkerLoop({ pool: makePool() as never }),
    ).rejects.toThrow(
      /METRICS_EXPORTER_INTERVAL_SECONDS must be a positive integer/,
    );
  });

  it("fails fast when the database connection check fails", async () => {
    const pool = makePool(async () => {
      throw new Error("connection refused");
    });

    await expect(startWorkerLoop({ pool: pool as never })).rejects.toThrow(
      "connection refused",
    );
    expect(logger.fatal).toHaveBeenCalled();
  });
});
