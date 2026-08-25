import { pino } from "pino";
import { getDbEnvs, getPgConnection } from "../migrations/scripts/shared.js";
import { cleanupDb } from "./cleanup-db.js";

const eventRetentionDays = 30;
const postgresEnvs = getDbEnvs();
const logger = pino();
const pool = getPgConnection(postgresEnvs);

try {
  await cleanupDb(pool, eventRetentionDays, logger);
} catch (err) {
  logger.error({ error: err }, "Error occurred during cronjob execution");
  process.exit(1);
} finally {
  await pool.end();
}

process.exit(0);
