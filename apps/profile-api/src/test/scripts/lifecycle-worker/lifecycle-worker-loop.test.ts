import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DPProxyConfig,
  EnvDbConfig,
  LogtoManagementConfig,
  M2MSdksConfig,
} from "~/plugins/external/env.js";

type CloseHandler = (params: { signal?: string }) => Promise<void>;
let closeHandler: CloseHandler | undefined;
const closeWithGrace = vi.fn(
  (_opts: { delay: number }, handler: CloseHandler) => {
    closeHandler = handler;
  },
);
vi.mock("close-with-grace", () => ({
  default: (opts: { delay: number }, handler: CloseHandler) =>
    closeWithGrace(opts, handler),
}));

const poolQuery = vi.fn();
const poolEnd = vi.fn();
vi.mock("~/migrations/scripts/shared.js", () => ({
  getPgConnection: vi.fn(() => ({ query: poolQuery, end: poolEnd })),
}));

const executeTask = vi.fn();
vi.mock("~/scripts/lifecycle-worker/execute-task.js", () => ({
  executeTask: (...args: unknown[]) => executeTask(...args),
}));

const writeHeartbeat = vi.fn();
vi.mock("~/scripts/lifecycle-worker/heartbeat.js", () => ({
  writeHeartbeat: (...args: unknown[]) => writeHeartbeat(...args),
}));

const resolveStuckTasks = vi.fn();
vi.mock("~/scripts/lifecycle-worker/resolve-stuck-tasks.js", () => ({
  resolveStuckTasks: (...args: unknown[]) => resolveStuckTasks(...args),
}));

import { startWorkerLoop } from "~/scripts/lifecycle-worker/lifecycle-worker-loop.js";

const params = {
  envDbConfig: {} as EnvDbConfig,
  logtoManagementConfig: {} as LogtoManagementConfig,
  dpProxyConfig: {
    DP_PROXY_API_BASE_URL: "https://dp.example",
    DP_PROXY_WEBHOOK_ACCESS_TOKEN: "token",
  } as Required<DPProxyConfig>,
  m2mSdksConfig: {} as M2MSdksConfig,
};

// Stop the loop from inside an iteration by invoking the captured
// close-with-grace handler, exactly like a SIGTERM would.
//
// Why this cannot deadlock: at the moment the executeTask mock runs, the
// loop's `taskPromise` is still null (the assignment `taskPromise =
// withTimeout(executeTask(...))` only completes after executeTask returns),
// so the shutdown handler's `if (taskPromise) await taskPromise` skips
// awaiting the very promise this mock is part of. If the production loop
// ever assigned taskPromise before invoking the task, the first test here
// would hang until its 30s timeout — failing loud, not flaking.
const stopAfter = (calls: number) => {
  let seen = 0;
  return async () => {
    seen++;
    if (seen >= calls && closeHandler) {
      await closeHandler({ signal: "SIGTERM" });
    }
  };
};

describe("startWorkerLoop", () => {
  const savedEnv = { ...process.env };
  let preexistingRejectionListeners: NodeJS.UnhandledRejectionListener[];
  let preexistingExceptionListeners: NodeJS.UncaughtExceptionListener[];

  beforeEach(() => {
    preexistingRejectionListeners = process.listeners("unhandledRejection");
    preexistingExceptionListeners = process.listeners("uncaughtException");
    vi.clearAllMocks();
    closeHandler = undefined;
    poolQuery.mockResolvedValue({ rows: [{ "?column?": 1 }] });
    poolEnd.mockResolvedValue(undefined);
    resolveStuckTasks.mockResolvedValue(undefined);
    process.env.WORKER_INTERVAL_SECONDS = "1";
  });

  afterEach(() => {
    // The loop installs exit-on-error process handlers; strip anything it
    // added so a later rejection in this worker can't call process.exit.
    for (const listener of process.listeners("unhandledRejection")) {
      if (!preexistingRejectionListeners.includes(listener)) {
        process.removeListener("unhandledRejection", listener);
      }
    }
    for (const listener of process.listeners("uncaughtException")) {
      if (!preexistingExceptionListeners.includes(listener)) {
        process.removeListener("uncaughtException", listener);
      }
    }
    process.env = { ...savedEnv };
  });

  it("runs one iteration, resolves stuck tasks and shuts down gracefully", async () => {
    executeTask.mockImplementation(stopAfter(1));

    await startWorkerLoop(params);

    expect(poolQuery).toHaveBeenCalledWith("SELECT 1");
    expect(executeTask).toHaveBeenCalledTimes(1);
    expect(resolveStuckTasks).toHaveBeenCalledTimes(1);
    // initial + before-task + after-iteration
    expect(writeHeartbeat).toHaveBeenCalledTimes(3);
    expect(poolEnd).toHaveBeenCalledTimes(1);
    // Shutdown delay bounded to task timeout + one interval, not MAX_INT.
    expect(closeWithGrace).toHaveBeenCalledWith(
      { delay: 30 * 60 * 1000 + 1000 },
      expect.any(Function),
    );
  });

  it("continues to resolve stuck tasks when executeTask throws", async () => {
    const stop = stopAfter(1);
    executeTask.mockImplementation(async () => {
      await stop();
      throw new Error("task blew up");
    });

    await expect(startWorkerLoop(params)).resolves.toBeUndefined();
    expect(resolveStuckTasks).toHaveBeenCalledTimes(1);
    expect(poolEnd).toHaveBeenCalledTimes(1);
  });

  it("sleeps between iterations while running", async () => {
    vi.useFakeTimers();
    try {
      let iterations = 0;
      executeTask.mockImplementation(async () => {
        iterations++;
        if (iterations >= 2 && closeHandler) {
          await closeHandler({ signal: "SIGINT" });
        }
      });

      const loop = startWorkerLoop(params);
      // First iteration + 1s sleep + second iteration (which stops the loop).
      await vi.advanceTimersByTimeAsync(1_000);
      await loop;

      expect(executeTask).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails fast when the database is unreachable", async () => {
    poolQuery.mockRejectedValue(new Error("connection refused"));

    await expect(startWorkerLoop(params)).rejects.toThrow("connection refused");
    expect(executeTask).not.toHaveBeenCalled();
  });

  it("installs process safety handlers that exit non-zero", async () => {
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);
    const onSpy = vi.spyOn(process, "on");
    try {
      executeTask.mockImplementation(stopAfter(1));
      await startWorkerLoop(params);

      // Invoke the captured handlers directly instead of emitting real
      // process events (which would also trip vitest's own listeners).
      const handlerFor = (event: string) =>
        onSpy.mock.calls.find(([name]) => name === event)?.[1] as (
          ...args: unknown[]
        ) => void;

      handlerFor("unhandledRejection")(new Error("dangling"));
      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockClear();
      handlerFor("unhandledRejection")("non-error rejection");
      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockClear();
      handlerFor("uncaughtException")(new Error("crash"));
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally {
      onSpy.mockRestore();
      exitSpy.mockRestore();
    }
  });
});
