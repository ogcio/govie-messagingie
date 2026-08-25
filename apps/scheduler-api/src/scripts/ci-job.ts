import type { Pool } from "pg";
import type { EnvDbConfig } from "../config.js";
import { doMigration } from "../migrations/scripts/migrate.js";
import { getDbEnvs, getPgConnection } from "../migrations/scripts/shared.js";

async function main(pgEnvs: EnvDbConfig, pool: Pool, migrationVersion: string) {
  console.log("");
  console.log("----------------");
  console.log("");
  console.log("Starting migration");

  try {
    await doMigration(pgEnvs, pool, migrationVersion);
  } catch (err) {
    console.error("Error during migration", err);
    throw err;
  }

  console.log("");
  console.log("Migration finished successfully");
  console.log("");
  console.log("----------------");
  console.log("");
}

const pgEnvs = getDbEnvs();
const pgConnection = getPgConnection(pgEnvs);
const migrationVersion = "max";

try {
  await main(pgEnvs, pgConnection, migrationVersion);
} catch {
  process.exit(1);
} finally {
  await pgConnection.end();
}

process.exit(0);
