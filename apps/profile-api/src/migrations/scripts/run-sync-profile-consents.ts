import { getDbEnvs, getPgConnection } from "./shared.js";
import { syncProfileConsents } from "./sync-profile-consents.js";

const pool = getPgConnection(getDbEnvs());
try {
  await syncProfileConsents(pool);
} finally {
  await pool.end();
}
process.exit(0);
