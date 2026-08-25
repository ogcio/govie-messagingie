import { buildLogtoClient } from "~/clients/logto.js";
import type { LogtoManagementConfig } from "~/plugins/external/env.js";
import { mergePpsns } from "./merge-ppsns.js";
import { getDbEnvs, getPgConnection } from "./shared.js";

const runMergePPSN =
  typeof process.env.RUN_MERGE_PPSNS === "string"
    ? process.env.RUN_MERGE_PPSNS
    : "";

let dryRun = true;

if (["1", "true"].includes(runMergePPSN.trim().toLowerCase())) {
  dryRun = false;
}

if (dryRun) {
  console.log("[Merge PPSNs] Skipping run.");
  process.exit(0);
}

const pool = getPgConnection(getDbEnvs());
try {
  await mergePpsns({
    pool,
    dryRun,
    getLogtoClient: () => buildLogtoClient(getLogtoConfig()),
  });
} finally {
  await pool.end();
}
process.exit(0);

function getLogtoConfig(): LogtoManagementConfig {
  const envs: Partial<LogtoManagementConfig> = {
    LOGTO_MANAGEMENT_API_ENDPOINT: process.env.LOGTO_MANAGEMENT_API_ENDPOINT,
    LOGTO_MANAGEMENT_API_CLIENT_ID: process.env.LOGTO_MANAGEMENT_API_CLIENT_ID,
    LOGTO_MANAGEMENT_API_RESOURCE_URL:
      process.env.LOGTO_MANAGEMENT_API_RESOURCE_URL,
    LOGTO_MANAGEMENT_API_CLIENT_SECRET:
      process.env.LOGTO_MANAGEMENT_API_CLIENT_SECRET,
    LOGTO_OIDC_ENDPOINT: process.env.LOGTO_OIDC_ENDPOINT,
  };

  for (const key in Object.keys(envs)) {
    if (!key) {
      throw new Error(`Cannot run merge ppsns, ${key} is missing`);
    }
  }

  return envs as LogtoManagementConfig;
}
