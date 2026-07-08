import { getDbEnvs } from "../../migrations/scripts/shared.js";
import { runBackfill } from "./backfill.js";

await runBackfill({
  envDbConfig: getDbEnvs(),
  // Full Prometheus remote-write URL, e.g.
  // https://prom.observability.dev.services.gov.ie/api/v1/metrics/write
  remoteWriteEndpoint:
    process.env.REMOTE_WRITE_ENDPOINT ?? "http://localhost:9009/api/v1/push",
});
