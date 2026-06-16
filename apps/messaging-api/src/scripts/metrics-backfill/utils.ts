import type { Pool } from "pg";
import type pino from "pino";
import { getPgConnection } from "../../migrations/scripts/shared.js";
import type { EnvDbConfig } from "../../plugins/external/env.js";
import {
  AGGREGATION_TEMPORALITY_CUMULATIVE,
  HTTP_BACKOFF_BASE_MS,
  HTTP_MAX_ATTEMPTS,
  HTTP_TIMEOUT_MS,
  MS_PER_DAY,
  NANOS_PER_MS,
  RESOURCE_ATTRIBUTES,
} from "./constants.js";

export type DailyCount = {
  organizationId: string;
  day: Date;
  counter: number;
};

export function parseUtcDate(input: string, label: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    throw new Error(`${label} must be in YYYY-MM-DD format (got "${input}")`);
  }
  const date = new Date(`${input}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} is not a valid date (got "${input}")`);
  }
  return date;
}

export async function fetchDailyCounts(
  pool: Pool,
  filter: {
    upperDate: Date;
    lowerDate: Date | undefined;
    organizationId: string | undefined;
  },
): Promise<DailyCount[]> {
  // Source of truth: messaging_event_logs row written immediately after a
  // successful email send (see services/jobs/job-service.ts where
  // messagesSentCounter.add(1) is followed by a MessagingEventType.deliverMessage
  // event log). Filtering on email transport mirrors the counter's condition.
  const params: unknown[] = [filter.upperDate.toISOString()];
  let whereLower = "";
  if (filter.lowerDate) {
    params.push(filter.lowerDate.toISOString());
    whereLower = `AND el.created_at >= $${params.length}`;
  }
  let whereOrg = "";
  if (filter.organizationId) {
    params.push(filter.organizationId);
    whereOrg = `AND m.organisation_id = $${params.length}`;
  }

  const result = await pool.query<{
    organizationId: string;
    day: Date;
    counter: string;
  }>(
    `
      SELECT
        m.organisation_id AS "organizationId",
        date_trunc('day', el.created_at AT TIME ZONE 'UTC') AS day,
        COUNT(*) AS counter
      FROM messaging_event_logs el
      JOIN messages m ON m.id = el.message_id
      WHERE el.event_type = 'message_delivery'
        AND el.event_status = 'successful'
        AND el.created_at < $1
        ${whereLower}
        ${whereOrg}
        AND m.preferred_transports IS NOT NULL
        AND 'email' = ANY(m.preferred_transports)
      GROUP BY m.organisation_id, day
      ORDER BY day, m.organisation_id
    `,
    params,
  );

  return result.rows.map((row) => ({
    organizationId: row.organizationId,
    day: new Date(row.day),
    counter: Number(row.counter),
  }));
}

export function groupByDay(rows: DailyCount[]): Map<string, DailyCount[]> {
  const byDay = new Map<string, DailyCount[]>();
  for (const row of rows) {
    const key = row.day.toISOString().slice(0, 10);
    const bucket = byDay.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      byDay.set(key, [row]);
    }
  }
  return byDay;
}

export function buildOtlpPayload(dayRows: DailyCount[]): unknown {
  const dataPoints = dayRows.map((row) => {
    const startMs = row.day.getTime();
    const endMs = startMs + MS_PER_DAY;
    return {
      asInt: String(row.counter),
      startTimeUnixNano: msToNanoString(startMs),
      timeUnixNano: msToNanoString(endMs),
      attributes: [
        {
          key: "organizationId",
          value: { stringValue: row.organizationId },
        },
      ],
    };
  });

  return {
    resourceMetrics: [
      {
        resource: { attributes: RESOURCE_ATTRIBUTES },
        scopeMetrics: [
          {
            scope: { name: "message_delivery" },
            metrics: [
              {
                name: "messages_sent",
                sum: {
                  aggregationTemporality: AGGREGATION_TEMPORALITY_CUMULATIVE,
                  isMonotonic: true,
                  dataPoints,
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

function msToNanoString(ms: number): string {
  return (BigInt(ms) * NANOS_PER_MS).toString();
}

export async function postOtlpWithRetry(
  payload: unknown,
  logger: pino.Logger,
  otelMetricsEndpoint: string,
): Promise<void> {
  const body = JSON.stringify(payload);
  let lastError: unknown;

  for (let attempt = 1; attempt <= HTTP_MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
    try {
      const response = await fetch(otelMetricsEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      });

      if (response.ok) return;

      // 4xx other than 429 will not get better on retry — fail fast so we
      // don't double-write or paper over a payload bug.
      const respBody = await response.text().catch(() => "");
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable) {
        throw new Error(
          `OTLP POST failed with non-retryable status ${response.status}: ${respBody || "<empty body>"}`,
        );
      }
      lastError = new Error(
        `OTLP POST failed with status ${response.status}: ${respBody || "<empty body>"}`,
      );
      logger.warn(
        { attempt, maxAttempts: HTTP_MAX_ATTEMPTS, status: response.status },
        "OTLP POST returned retryable status",
      );
    } catch (error) {
      lastError = error;
      logger.warn(
        {
          attempt,
          maxAttempts: HTTP_MAX_ATTEMPTS,
          error: error instanceof Error ? error.message : error,
        },
        "OTLP POST attempt failed",
      );
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < HTTP_MAX_ATTEMPTS) {
      const backoff = HTTP_BACKOFF_BASE_MS * 2 ** (attempt - 1);
      await sleep(backoff);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("OTLP POST failed after retries");
}

export function nextDayKey(dayKey: string): string {
  const next = new Date(`${dayKey}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function connectToDatabase(
  dbConfig: EnvDbConfig,
  logger: pino.Logger,
): Promise<Pool> {
  const pool = getPgConnection(dbConfig, { idleTimeoutMillis: 3000 });

  try {
    await pool.query("SELECT 1");
  } catch (error) {
    logger.fatal({ error }, "Failed to connect to the database");
    await pool.end();
    throw error;
  }

  return pool;
}
