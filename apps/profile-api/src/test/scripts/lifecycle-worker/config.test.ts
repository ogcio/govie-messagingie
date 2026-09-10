import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getHeartbeatFilePath,
  getIntervalSeconds,
  getMaxHeartbeatStalenessMs,
  getStreamIdleTimeoutMs,
  getTaskTimeoutMs,
} from "~/scripts/lifecycle-worker/config.js";

const ENV_KEYS = [
  "WORKER_INTERVAL_SECONDS",
  "WORKER_TASK_TIMEOUT_SECONDS",
  "WORKER_STREAM_IDLE_TIMEOUT_SECONDS",
  "WORKER_MAX_HEARTBEAT_STALENESS_SECONDS",
  "WORKER_HEARTBEAT_FILE",
];

describe("lifecycle-worker config", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
  });

  it("returns defaults when env vars are unset", () => {
    expect(getIntervalSeconds()).toBe(60);
    expect(getTaskTimeoutMs()).toBe(30 * 60 * 1000);
    expect(getStreamIdleTimeoutMs()).toBe(120 * 1000);
    expect(getMaxHeartbeatStalenessMs()).toBe(40 * 60 * 1000);
    expect(getHeartbeatFilePath()).toBe("/tmp/lifecycle-worker-heartbeat");
  });

  it("reads configured positive integers", () => {
    process.env.WORKER_INTERVAL_SECONDS = "5";
    process.env.WORKER_TASK_TIMEOUT_SECONDS = "10";
    process.env.WORKER_STREAM_IDLE_TIMEOUT_SECONDS = "15";
    process.env.WORKER_MAX_HEARTBEAT_STALENESS_SECONDS = "20";
    process.env.WORKER_HEARTBEAT_FILE = "/tmp/custom-heartbeat";

    expect(getIntervalSeconds()).toBe(5);
    expect(getTaskTimeoutMs()).toBe(10 * 1000);
    expect(getStreamIdleTimeoutMs()).toBe(15 * 1000);
    expect(getMaxHeartbeatStalenessMs()).toBe(20 * 1000);
    expect(getHeartbeatFilePath()).toBe("/tmp/custom-heartbeat");
  });

  it("falls back to the default for an empty string", () => {
    process.env.WORKER_INTERVAL_SECONDS = "";
    process.env.WORKER_HEARTBEAT_FILE = "";
    expect(getIntervalSeconds()).toBe(60);
    expect(getHeartbeatFilePath()).toBe("/tmp/lifecycle-worker-heartbeat");
  });

  it("throws for non-numeric or non-positive values", () => {
    process.env.WORKER_INTERVAL_SECONDS = "abc";
    expect(() => getIntervalSeconds()).toThrowError(
      "WORKER_INTERVAL_SECONDS must be a positive integer",
    );

    process.env.WORKER_INTERVAL_SECONDS = "0";
    expect(() => getIntervalSeconds()).toThrowError(
      "WORKER_INTERVAL_SECONDS must be a positive integer",
    );

    process.env.WORKER_INTERVAL_SECONDS = "-3";
    expect(() => getIntervalSeconds()).toThrowError(
      "WORKER_INTERVAL_SECONDS must be a positive integer",
    );
  });
});
