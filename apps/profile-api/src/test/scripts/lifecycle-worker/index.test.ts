import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const startWorkerLoop = vi.fn();
vi.mock("~/scripts/lifecycle-worker/lifecycle-worker-loop.js", () => ({
  startWorkerLoop: (...args: unknown[]) => startWorkerLoop(...args),
}));

vi.mock("~/migrations/scripts/shared.js", () => ({
  getDbEnvs: vi.fn(() => ({ POSTGRES_DB_NAME: "test" })),
}));

// The entrypoint runs at import: it builds all configs from env then starts
// the loop.
const runEntrypoint = async () => {
  vi.resetModules();
  await import("~/scripts/lifecycle-worker/index.js");
};

describe("lifecycle-worker entrypoint", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    startWorkerLoop.mockResolvedValue(undefined);
    process.env.DP_PROXY_API_BASE_URL = "https://dp.example";
    process.env.DP_PROXY_WEBHOOK_ACCESS_TOKEN = "dp-token";
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("starts the worker loop with configs from the environment", async () => {
    await runEntrypoint();

    expect(startWorkerLoop).toHaveBeenCalledWith(
      expect.objectContaining({
        envDbConfig: { POSTGRES_DB_NAME: "test" },
        dpProxyConfig: {
          DP_PROXY_API_BASE_URL: "https://dp.example",
          DP_PROXY_WEBHOOK_ACCESS_TOKEN: "dp-token",
        },
      }),
    );
  });

  it("fails fast when the DP proxy token is missing", async () => {
    delete process.env.DP_PROXY_WEBHOOK_ACCESS_TOKEN;

    await expect(runEntrypoint()).rejects.toThrow(
      "DP_PROXY_WEBHOOK_ACCESS_TOKEN is not defined",
    );
    expect(startWorkerLoop).not.toHaveBeenCalled();
  });

  it("fails fast when the DP proxy url is missing", async () => {
    delete process.env.DP_PROXY_API_BASE_URL;

    await expect(runEntrypoint()).rejects.toThrow(
      "DP_PROXY_API_BASE_URL is not defined",
    );
    expect(startWorkerLoop).not.toHaveBeenCalled();
  });
});
