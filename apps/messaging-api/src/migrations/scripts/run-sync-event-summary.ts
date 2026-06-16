import { getDbEnvs, getPgConnection } from "./shared.js";
import { syncEventSummaryCommand } from "./sync-event-summary.js";

let fullResync = false;
for (const arg of process.argv.slice(2)) {
  if (arg.length && arg.toLowerCase() === "--full-resync") {
    fullResync = true;
    break;
  }
}

const pool = getPgConnection(getDbEnvs());

try {
  await syncEventSummaryCommand(pool, fullResync);
} catch (err) {
  console.error("Error during sync event summary", err);
  process.exit(1);
} finally {
  await pool.end();
}

process.exit(0);
