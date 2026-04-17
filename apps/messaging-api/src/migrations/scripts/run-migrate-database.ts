import { doMigration } from "./migrate.js";
import { getDbEnvs } from "./shared.js";

let version = "max";
for (const arg of process.argv.slice(2)) {
  if (arg.length && arg.startsWith("version=")) {
    version = arg.replace("version=", "");
    break;
  }
}

doMigration(getDbEnvs(), version);
