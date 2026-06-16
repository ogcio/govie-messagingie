import { getErrorMessage } from "@ogcio/shared-errors";
import closeWithGrace from "close-with-grace";
import type { Pool } from "pg";
import pino from "pino";
import { getPendingJobPerOrganization } from "../../services/jobs/job-service.js";
import { messagesQueueGauge } from "../../utils/metrics.js";

function getIntervalSeconds(): number {
  const intervalStr = process.env.METRICS_EXPORTER_INTERVAL_SECONDS ?? "60";

  const interval = Number.parseInt(intervalStr, 10);
  if (Number.isNaN(interval) || interval <= 0) {
    throw new Error(
      "METRICS_EXPORTER_INTERVAL_SECONDS must be a positive integer",
    );
  }
  return interval;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function startWorkerLoop(params: { pool: Pool }): Promise<void> {
  const logger = pino.pino();
  const intervalSeconds = getIntervalSeconds();
  const intervalMs = intervalSeconds * 1000;
  const pool = await checkDbConnection(params.pool, logger);

  let running = true;

  logger.info({
    message: "Starting metrics exporter worker loop",
    intervalSeconds,
  });

  // Close with grace accepts a maximum delay of MAX_SIGNED_INTEGER
  const MAX_SIGNED_INTEGER = 2_147_483_647;
  // Set up graceful shutdown with infinite delay to wait for task completion
  closeWithGrace({ delay: MAX_SIGNED_INTEGER }, async ({ signal }) => {
    logger.info({
      message: "Received shutdown signal",
      signal,
    });
    running = false;

    await pool.end();
    logger.info({ message: "Shutdown complete" });
  });

  while (running) {
    const pendingJobs = await getPendingJobPerOrganization({
      pool,
      logger,
    });
    logger.info({
      message: "Fetched pending jobs per organization",
      count: pendingJobs.length,
    });
    pendingJobs.forEach((job) => {
      messagesQueueGauge.record(job.counter, {
        organizationId: job.organizationId,
      });
    });

    if (running) {
      // Only sleep if we're still running
      await sleep(intervalMs);
    }
  }
}

async function checkDbConnection(
  pool: Pool,
  logger: pino.Logger,
): Promise<Pool> {
  try {
    await pool.query("SELECT 1"); // Test the connection
  } catch (error) {
    logger.fatal(
      { error: getErrorMessage(error) },
      "Failed to connect to the database:",
    );
    throw error;
  }

  return pool;
}
