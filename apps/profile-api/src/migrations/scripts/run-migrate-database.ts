import { doMigration } from "./migrate.js";
import { getDbEnvs, getPgConnection } from "./shared.js";

let version = "max";
for (const arg of process.argv.slice(2)) {
  if (arg.length && arg.startsWith("version=")) {
    version = arg.replace("version=", "");
    break;
  }
}

const dbEnvs = getDbEnvs();
const pool = getPgConnection(dbEnvs);
try {
  await doMigration(dbEnvs, pool, version);
} finally {
  await pool.end();
  process.exit(0);
}
