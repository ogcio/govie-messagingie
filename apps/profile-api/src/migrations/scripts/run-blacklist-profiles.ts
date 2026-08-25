import { blacklistProfiles } from "./blacklist-profiles.js";
import { getDbEnvs, getPgConnection } from "./shared.js";

const pool = getPgConnection(getDbEnvs());
try {
  await blacklistProfiles(pool);
} finally {
  await pool.end();
}
process.exit(0);
