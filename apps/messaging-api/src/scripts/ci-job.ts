/**
 * This script is intended to be used in CI jobs to run the database migration and any related scripts.
 * It is needed when using DHI images, given that they do not allow using npm or pnpm to run scripts.
 * This will be invoked like `node dist/scripts/ci-job.js` in ci.
 */

import { createDatabase } from "../migrations/scripts/create-database.js";
import { doMigration } from "../migrations/scripts/migrate.js";
import { getDbEnvs } from "../migrations/scripts/shared.js";
import { syncEventSummaryCommand } from "../migrations/scripts/sync-event-summary.js";

const migrationVersion = "max";
const postgresEnvs = getDbEnvs();

console.log("Creating database if it does not exist...");
try {
  await createDatabase(postgresEnvs);
  console.log("Database setup completed.");
} catch (err) {
  console.error("Error during database setup", err);
  process.exit(1);
}

console.log("");
console.log("----------------");
console.log("");

console.log(`Running migration for version ${migrationVersion}...`);
try {
  await doMigration(postgresEnvs, migrationVersion);
} catch (err) {
  console.error("Error during migration", err);
  process.exit(1);
}
console.log("Migration completed.");

console.log("");
console.log("----------------");
console.log("");

console.log("Sync event summary...");

try {
  await syncEventSummaryCommand(getDbEnvs(), false);
  console.log("Sync event summary completed.");
} catch (err) {
  console.error("Error during sync event summary", err);
  process.exit(1);
}

process.exit(0);
