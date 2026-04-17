import { getDbEnvs } from "./shared.js";
import { syncEventSummaryCommand } from "./sync-event-summary.js";

let fullResync = false;
for (const arg of process.argv.slice(2)) {
  if (arg.length && arg.toLowerCase() === "--full-resync") {
    fullResync = true;
    break;
  }
}

syncEventSummaryCommand(getDbEnvs(), fullResync);
