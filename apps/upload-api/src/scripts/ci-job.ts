/**
 * This file is responsible to run startup jobs during deployment.
 * We created this single file in this path because the k8s job was pointing to this path
 * and we wanted to keep all migration related scripts in the same folder to avoid having to
 * change the job definition one deployment a time.
 * We could remove this file and use a script in another path once we've deployed the
 * postgrator code to all environments.
 */

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
