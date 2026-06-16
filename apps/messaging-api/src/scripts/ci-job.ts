/**
 * This script is intended to be used in CI jobs to run the database migration and any related scripts.
 * It is needed when using DHI images, given that they do not allow using npm or pnpm to run scripts.
 * This will be invoked like `node dist/scripts/ci-job.js` in ci.
 */

import type { Pool } from "pg";
import { doMigration } from "../migrations/scripts/migrate.js";
import { getDbEnvs, getPgConnection } from "../migrations/scripts/shared.js";
import { syncEventSummaryCommand } from "../migrations/scripts/sync-event-summary.js";

const migrationVersion = "max";
const postgresEnvs = getDbEnvs();

async function main(pool: Pool, migrationVersion: string): Promise<void> {
  console.log("");
  console.log("----------------");
  console.log("");

  console.log(`Running migration for version ${migrationVersion}...`);
  try {
    await doMigration(postgresEnvs, pool, migrationVersion);
  } catch (err) {
    console.error("Error during migration", err);
    throw err;
  }
  console.log("Migration completed.");

  console.log("");
  console.log("----------------");
  console.log("");

  console.log("Sync event summary...");

  try {
    await syncEventSummaryCommand(pool, false);
    console.log("Sync event summary completed.");
  } catch (err) {
    console.error("Error during sync event summary", err);
    throw err;
  }
}

const dbEnvs = getDbEnvs();
const pool = getPgConnection(dbEnvs);

try {
  await main(pool, migrationVersion);
} catch {
  process.exit(1);
} finally {
  await pool.end();
}

process.exit(0);
