import { getDbEnvs, getPgConnection } from "../../migrations/scripts/shared.js";
import type { EnvDbConfig } from "../../plugins/external/env.js";
import { startWorkerLoop } from "./worker-loop.js";

const envDbConfig = getDbEnvs();
const dbEnvs: EnvDbConfig | string = process.env.DATABASE_TEST_URL?.length
  ? process.env.DATABASE_TEST_URL
  : envDbConfig;
const pool = getPgConnection(dbEnvs, { idleTimeoutMillis: 3000 });

try {
  await startWorkerLoop({
    pool,
  });
} catch (err) {
  console.error("Error in metrics exporter worker loop", err);
  process.exit(1);
} finally {
  await pool.end();
}

process.exit(0);
