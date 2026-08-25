import { seedConsentStatements } from "./seed-consent-statements.js";
import { getDbEnvs, getPgConnection } from "./shared.js";

const pool = getPgConnection(getDbEnvs());
try {
  await seedConsentStatements(pool);
} finally {
  await pool.end();
}
process.exit(0);
