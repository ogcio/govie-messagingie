import closeWithGrace from "close-with-grace";
import pino from "pino";
import type { EnvDbConfig } from "../../plugins/external/env.js";
import {
  DRY_RUN,
  LOWER_DATE,
  ORGANIZATION_ID,
  PER_REQUEST_DELAY_MS,
  UPPER_DATE,
} from "./constants.js";
import {
  buildOtlpPayload,
  connectToDatabase,
  fetchDailyCounts,
  groupByDay,
  nextDayKey,
  parseUtcDate,
  postOtlpWithRetry,
  sleep,
} from "./utils.js";

export async function runBackfill(params: {
  envDbConfig: EnvDbConfig;
  otelEndpoint: string;
}): Promise<void> {
  const logger = pino.pino();
  const upperDate = parseUtcDate(UPPER_DATE, "UPPER_DATE");
  const lowerDate = LOWER_DATE
    ? parseUtcDate(LOWER_DATE, "LOWER_DATE")
    : undefined;
  if (lowerDate && lowerDate >= upperDate) {
    throw new Error("LOWER_DATE must be strictly before UPPER_DATE");
  }

  const pool = await connectToDatabase(params.envDbConfig, logger);

  const otelMetricsEndpoint = `${params.otelEndpoint}/v1/metrics`;

  logger.info(
    {
      endpoint: otelMetricsEndpoint,
      upperDate: upperDate.toISOString(),
      lowerDate: lowerDate?.toISOString(),
      organizationId: ORGANIZATION_ID,
      dryRun: DRY_RUN,
    },
    "Starting messages_sent backfill",
  );

  // Stop the per-day loop on SIGTERM/SIGINT (K8s pod eviction or deadline).
  // We never abort an in-flight POST: the operator needs to know whether the
  // current day made it to the collector or not. The loop checks `running`
  // between days and exits cleanly so the final summary logs the last
  // successfully POSTed day for resume.
  let running = true;
  let lastCompletedDay: string | undefined;
  const MAX_SIGNED_INTEGER = 2_147_483_647;
  closeWithGrace({ delay: MAX_SIGNED_INTEGER }, async ({ signal }) => {
    logger.warn(
      { signal, lastCompletedDay },
      "Received shutdown signal, will exit after current day",
    );
    running = false;
  });

  try {
    const rows = await fetchDailyCounts(pool, {
      upperDate,
      lowerDate,
      organizationId: ORGANIZATION_ID,
    });
    logger.info(
      { rowCount: rows.length },
      "Fetched daily aggregated counts from database",
    );

    if (!rows.length) {
      logger.warn("No rows to backfill, exiting");
      return;
    }

    const byDay = groupByDay(rows);
    const days = Array.from(byDay.keys()).sort();
    logger.info(
      { dayCount: days.length, firstDay: days[0], lastDay: days.at(-1) },
      "Grouped rows by day",
    );

    let totalDataPoints = 0;
    let totalMessages = 0;
    for (const [index, dayKey] of days.entries()) {
      if (!running) {
        logger.warn(
          { lastCompletedDay, remaining: days.length - index },
          "Aborting before next day due to shutdown signal",
        );
        break;
      }
      const dayRows = byDay.get(dayKey);
      if (!dayRows) continue;
      const dayMessages = dayRows.reduce((sum, r) => sum + r.counter, 0);

      const payload = buildOtlpPayload(dayRows);

      if (DRY_RUN) {
        logger.info(
          {
            day: dayKey,
            dataPoints: dayRows.length,
            messages: dayMessages,
            dryRun: true,
          },
          "Would POST daily payload",
        );
      } else {
        await postOtlpWithRetry(payload, logger, otelMetricsEndpoint);
        logger.info(
          {
            day: dayKey,
            dataPoints: dayRows.length,
            messages: dayMessages,
            progress: `${index + 1}/${days.length}`,
            lastCompletedDay: dayKey,
            resumeWith: `LOWER_DATE=${nextDayKey(dayKey)}`,
          },
          "POSTed daily payload",
        );
        if (PER_REQUEST_DELAY_MS > 0) {
          await sleep(PER_REQUEST_DELAY_MS);
        }
      }

      lastCompletedDay = dayKey;
      totalDataPoints += dayRows.length;
      totalMessages += dayMessages;
    }

    logger.info(
      {
        days: days.length,
        dataPoints: totalDataPoints,
        messages: totalMessages,
        lastCompletedDay,
        dryRun: DRY_RUN,
      },
      running ? "Backfill complete" : "Backfill stopped early",
    );
  } catch (error) {
    logger.error(
      {
        error,
        lastCompletedDay,
        resumeWith: lastCompletedDay
          ? `LOWER_DATE=${nextDayKey(lastCompletedDay)}`
          : undefined,
      },
      "Backfill failed",
    );
    throw error;
  } finally {
    await pool.end();
  }
}
