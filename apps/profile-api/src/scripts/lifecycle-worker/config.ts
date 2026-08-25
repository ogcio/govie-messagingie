const DEFAULT_WORKER_INTERVAL_SECONDS = 60;
// A single task must be time-bounded end-to-end so one hung external call can
// never stall the single-flight loop indefinitely (root cause of the
// 2026-07-16 -> 2026-07-23 silent outage). Kept below IS_STUCK_AFTER_MINUTES
// (60) so the DB row is still reclaimable by resolveStuckTasks afterwards.
const DEFAULT_TASK_TIMEOUT_SECONDS = 30 * 60;
// Inactivity guard for streamed multipart file downloads: if no bytes arrive
// for this long the upstream connection is considered dead and is destroyed.
const DEFAULT_STREAM_IDLE_TIMEOUT_SECONDS = 120;
// Liveness backstop: if the loop has not made progress (written a heartbeat)
// within this window, the process is considered wedged and the liveness probe
// fails so Kubernetes restarts the pod. Must exceed the per-task timeout so a
// legitimately long task is never killed mid-flight.
const DEFAULT_MAX_HEARTBEAT_STALENESS_SECONDS = 40 * 60;

const DEFAULT_HEARTBEAT_FILE = "/tmp/lifecycle-worker-heartbeat";

function readPositiveIntEnv(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.length === 0) {
    return defaultValue;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

export function getIntervalSeconds(): number {
  return readPositiveIntEnv(
    "WORKER_INTERVAL_SECONDS",
    DEFAULT_WORKER_INTERVAL_SECONDS,
  );
}

export function getTaskTimeoutMs(): number {
  return (
    readPositiveIntEnv(
      "WORKER_TASK_TIMEOUT_SECONDS",
      DEFAULT_TASK_TIMEOUT_SECONDS,
    ) * 1000
  );
}

export function getStreamIdleTimeoutMs(): number {
  return (
    readPositiveIntEnv(
      "WORKER_STREAM_IDLE_TIMEOUT_SECONDS",
      DEFAULT_STREAM_IDLE_TIMEOUT_SECONDS,
    ) * 1000
  );
}

export function getMaxHeartbeatStalenessMs(): number {
  return (
    readPositiveIntEnv(
      "WORKER_MAX_HEARTBEAT_STALENESS_SECONDS",
      DEFAULT_MAX_HEARTBEAT_STALENESS_SECONDS,
    ) * 1000
  );
}

export function getHeartbeatFilePath(): string {
  const configured = process.env.WORKER_HEARTBEAT_FILE;
  return configured && configured.length > 0
    ? configured
    : DEFAULT_HEARTBEAT_FILE;
}
