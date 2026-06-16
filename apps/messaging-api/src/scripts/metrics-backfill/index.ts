import { getDbEnvs } from "../../migrations/scripts/shared.js";
import { runBackfill } from "./backfill.js";

await runBackfill({
  envDbConfig: getDbEnvs(),
  otelEndpoint: process.env.OTEL_ENDPOINT ?? "http://localhost:4318",
});
