import { getDbEnvs } from "../../migrations/scripts/shared.js";
import { startWorkerLoop } from "./worker-loop.js";

await startWorkerLoop({
  envDbConfig: getDbEnvs(),
});
