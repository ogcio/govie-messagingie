import { writeFileSync } from "node:fs";
import { getHeartbeatFilePath } from "./config.js";

/**
 * Records loop progress by writing the current epoch-millis timestamp to the
 * heartbeat file. The liveness probe reads this file: as long as the loop keeps
 * ticking the pod stays healthy; if the loop wedges the file goes stale and
 * Kubernetes restarts the pod. Failures to write are swallowed so a transient
 * filesystem issue never crashes the worker.
 */
export function writeHeartbeat(
  filePath: string = getHeartbeatFilePath(),
  now: number = Date.now(),
): void {
  try {
    writeFileSync(filePath, String(now), "utf8");
  } catch {
    // Best-effort: never let heartbeat bookkeeping take down the worker.
  }
}

/**
 * Pure staleness check shared by the loop and the liveness probe so both agree
 * on what "stuck" means. Unparseable or missing contents count as stale.
 */
export function isHeartbeatStale(
  contents: string | undefined | null,
  nowMs: number,
  maxStalenessMs: number,
): boolean {
  if (!contents) {
    return true;
  }

  const lastBeatMs = Number.parseInt(contents.trim(), 10);
  if (Number.isNaN(lastBeatMs)) {
    return true;
  }

  return nowMs - lastBeatMs > maxStalenessMs;
}
