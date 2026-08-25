import { readFileSync } from "node:fs";
import { getHeartbeatFilePath, getMaxHeartbeatStalenessMs } from "./config.js";
import { isHeartbeatStale } from "./heartbeat.js";

/**
 * Standalone liveness probe for the lifecycle worker, invoked by Kubernetes as
 * an `exec` probe (`node ./dist/scripts/lifecycle-worker/liveness-probe.js`).
 *
 * Exit code 0 => healthy (loop made progress recently).
 * Exit code 1 => unhealthy (heartbeat missing/stale) => pod is restarted.
 *
 * This is the backstop that would have bounded the 2026-07-16 outage to minutes
 * instead of ~6.5 days: a wedged loop stops updating the heartbeat, the probe
 * fails, and the pod is recreated with a fresh loop.
 */
function main(): void {
  const filePath = getHeartbeatFilePath();
  const maxStalenessMs = getMaxHeartbeatStalenessMs();

  let contents: string | undefined;
  try {
    contents = readFileSync(filePath, "utf8");
  } catch {
    // No heartbeat yet. During startup the probe's initialDelaySeconds covers
    // this; afterwards a missing file means the loop never got going.
    contents = undefined;
  }

  if (isHeartbeatStale(contents, Date.now(), maxStalenessMs)) {
    process.stderr.write(
      `lifecycle-worker heartbeat stale (file=${filePath}, maxStalenessMs=${maxStalenessMs})\n`,
    );
    process.exit(1);
  }

  process.exit(0);
}

main();
