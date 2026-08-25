/**
 * This script is intended to be used in CI jobs to run the database migration and any related scripts.
 * It is needed when using DHI images, given that they do not allow using npm or pnpm to run scripts.
 * This will be invoked like `node dist/scripts/ci-job.js` in ci.
 */

import type { Pool } from "pg";
import pino from "pino";
import { seedConsentStatements } from "~/migrations/scripts/seed-consent-statements.js";
import { syncProfileConsents } from "~/migrations/scripts/sync-profile-consents.js";
import type { EnvDbConfig } from "~/plugins/external/env.js";
import { normalizeDateOfBirth } from "~/services/profiles/normalize-date-of-birth.js";
import { doMigration } from "../migrations/scripts/migrate.js";
import { getDbEnvs, getPgConnection } from "../migrations/scripts/shared.js";

async function runActions(
  pool: Pool,
  postgresEnvs: EnvDbConfig,
  migrationVersion: string,
) {
  try {
    console.log(`Running migration for version ${migrationVersion}...`);
    await doMigration(postgresEnvs, pool, migrationVersion);
  } catch (err) {
    console.error("Error during migration", err);
    process.exit(1);
  }
  console.log("Migration completed.");

  console.log("");
  console.log("----------------");
  console.log("");

  console.log("Seed profile consent statements...");

  try {
    await seedConsentStatements(pool);
    console.log("Seed profile consent statements completed.");
  } catch (err) {
    console.error("Error during seed profile consent statements", err);
    process.exit(1);
  }

  console.log("");
  console.log("----------------");
  console.log("");
  console.log("Run sync profile consents...");

  try {
    await syncProfileConsents(pool);
    console.log("Sync profile consents completed.");
  } catch (err) {
    console.error("Error during sync profile consents", err);
    process.exit(1);
  }

  console.log("");
  console.log("----------------");
  console.log("");

  const enableFormatDates = process.argv.includes("--enable-format-dates");

  if (enableFormatDates) {
    console.log("Run normalize dates...");

    try {
      await normalizeDateOfBirth({ pool, logger: pino() });
      console.log("Normalize dates completed.");
    } catch (err) {
      console.error("Error during normalize dates", err);
      process.exit(1);
    }

    console.log("");
    console.log("----------------");
    console.log("");
  }

  // Blacklist profiles and merge-ppsns scripts are not needed anymore, ignoring them.
}

const migrationVersion = "max";
const postgresEnvs = getDbEnvs();
const pool = getPgConnection(postgresEnvs);

try {
  await runActions(pool, postgresEnvs, migrationVersion);
} finally {
  await pool.end();
}

process.exit(0);
