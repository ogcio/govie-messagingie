import type { Pool } from "pg";
import type pino from "pino";
import { getPgConnection } from "../../migrations/scripts/shared.js";
import type { EnvDbConfig } from "../../plugins/external/env.js";
import {
  COLLECTOR_TOKEN_APP_ID,
  COLLECTOR_TOKEN_APP_SECRET,
  HTTP_BACKOFF_BASE_MS,
  HTTP_MAX_ATTEMPTS,
  HTTP_TIMEOUT_MS,
  LOGTO_OIDC_ENDPOINT,
  TOKEN_EXPIRY_SKEW_MS,
} from "./constants.js";

export type DailyCount = {
  organizationId: string;
  day: Date;
  // Messages on this day (used for per-day logging/summaries).
  counter: number;
  // Running total for this org through this day — the value written as the
  // counter sample (see remote-write.ts).
  cumulative: number;
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
  // Org filter goes in the inner query (a per-org restriction doesn't affect
  // that org's own running total).
  let whereOrg = "";
  if (filter.organizationId) {
    params.push(filter.organizationId);
    whereOrg = `AND m.organisation_id = $${params.length}`;
  }
  // Lower bound goes in the OUTER query, AFTER the running total is computed —
  // so a resumed run (LOWER_DATE set) still emits values that include all prior
  // history, keeping the counter continuous with no artificial reset.
  let whereLower = "";
  if (filter.lowerDate) {
    params.push(filter.lowerDate.toISOString());
    whereLower = `WHERE day >= $${params.length}`;
  }

  const result = await pool.query<{
    organizationId: string;
    day: Date;
    counter: string;
    cumulative: string;
  }>(
    `
      SELECT "organizationId", day, counter, cumulative
      FROM (
        SELECT
          m.organisation_id AS "organizationId",
          date_trunc('day', el.created_at AT TIME ZONE 'UTC') AS day,
          COUNT(*) AS counter,
          SUM(COUNT(*)) OVER (
            PARTITION BY m.organisation_id
            ORDER BY date_trunc('day', el.created_at AT TIME ZONE 'UTC')
          ) AS cumulative
        FROM messaging_event_logs el
        JOIN messages m ON m.id = el.message_id
        WHERE el.event_type = 'message_delivery'
          AND el.event_status = 'successful'
          AND el.created_at < $1
          ${whereOrg}
          AND m.preferred_transports IS NOT NULL
          AND 'email' = ANY(m.preferred_transports)
        GROUP BY m.organisation_id, day
      ) daily
      ${whereLower}
      ORDER BY day, "organizationId"
    `,
    params,
  );

  return result.rows.map((row) => ({
    organizationId: row.organizationId,
    day: new Date(row.day),
    counter: Number(row.counter),
    cumulative: Number(row.cumulative),
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

export type CollectorTokenProvider = (options?: {
  forceRefresh?: boolean;
}) => Promise<string | undefined>;

type TokenResponse = { access_token: string; expires_in?: number };

export function createCollectorTokenProvider(
  logger: pino.Logger,
): CollectorTokenProvider {
  if (!COLLECTOR_TOKEN_APP_ID || !COLLECTOR_TOKEN_APP_SECRET) {
    logger.warn(
      "No collector M2M credentials configured (O11Y_ALLOY_CLIENT_ID/SECRET); POSTing without Authorization header",
    );
    return async () => undefined;
  }
  if (!LOGTO_OIDC_ENDPOINT) {
    throw new Error(
      "METRICS_BACKFILL_LOGTO_OIDC_ENDPOINT must be set to mint a collector token",
    );
  }

  const tokenUrl = LOGTO_OIDC_ENDPOINT.endsWith("/")
    ? `${LOGTO_OIDC_ENDPOINT}token`
    : `${LOGTO_OIDC_ENDPOINT}/token`;
  const basicAuth = Buffer.from(
    `${COLLECTOR_TOKEN_APP_ID}:${COLLECTOR_TOKEN_APP_SECRET}`,
  ).toString("base64");

  let cachedToken: string | undefined;
  let expiresAtMs = 0;

  return async (options) => {
    if (
      !options?.forceRefresh &&
      cachedToken &&
      Date.now() < expiresAtMs - TOKEN_EXPIRY_SKEW_MS
    ) {
      return cachedToken;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
    try {
      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${basicAuth}`,
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          organization_id: "ogcio",
          scope: "o11y:metrics:*",
        }).toString(),
        signal: controller.signal,
      });

      if (!response.ok) {
        const respBody = await response.text().catch(() => "");
        throw new Error(
          `Logto token request failed with status ${response.status}: ${respBody || "<empty body>"}`,
        );
      }

      const json = (await response.json()) as TokenResponse;
      if (!json.access_token) {
        throw new Error("Logto token response is missing access_token");
      }
      cachedToken = json.access_token;
      expiresAtMs = Date.now() + (json.expires_in ?? 3600) * 1000;
      logger.info(
        { expiresInS: json.expires_in },
        "Obtained collector access token",
      );
      return cachedToken;
    } finally {
      clearTimeout(timeout);
    }
  };
}

export async function postWithRetry(
  body: Uint8Array,
  baseHeaders: Record<string, string>,
  logger: pino.Logger,
  endpoint: string,
  getToken: CollectorTokenProvider,
): Promise<void> {
  let lastError: unknown;

  // Re-wrap so the type is Uint8Array<ArrayBuffer> (what fetch's BodyInit wants;
  // protobufjs/snappy return the generic Uint8Array<ArrayBufferLike>).
  const requestBody = new Uint8Array(body);

  logger.info(
    { endpoint, bodyBytes: requestBody.byteLength },
    "Remote-write request payload",
  );

  for (let attempt = 1; attempt <= HTTP_MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
    try {
      const headers: Record<string, string> = { ...baseHeaders };
      const token = await getToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      logger.info(
        {
          attempt,
          maxAttempts: HTTP_MAX_ATTEMPTS,
          endpoint,
          tokenAttached: Boolean(token),
        },
        "Posting...",
      );

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: requestBody,
        signal: controller.signal,
      });

      const respBody = await response.text().catch(() => "");
      const responseLog = {
        status: response.status,
        ok: response.ok,
        responseHeaders: Object.fromEntries(response.headers.entries()),
        responseBody: respBody || "<empty body>",
      };

      if (response.status <= 299) {
        logger.info({ ...responseLog }, "Remote-write accepted (2xx)");

        return;
      }

      // 401/403 means the token was rejected (expired mid-run, or revoked).
      // Force a refresh and retry rather than failing fast — the next attempt
      // mints a fresh token.
      if (response.status === 401 || response.status === 403) {
        await getToken({ forceRefresh: true });
        lastError = new Error(
          `Remote-write rejected with status ${response.status}: ${respBody || "<empty body>"}`,
        );
        logger.warn(
          responseLog,
          "Remote-write unauthorized, refreshing token and retrying",
        );
      } else {
        // 4xx other than 401/403/429 will not get better on retry — fail fast
        // so we don't double-write or paper over a payload bug.
        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable) {
          lastError = new Error(
            `Remote-write failed with non-retryable status ${response.status}: ${respBody || "<empty body>"}`,
          );
          logger.warn(
            responseLog,
            "Remote-write returned non-retryable status",
          );
          break;
        }
        lastError = new Error(
          `Remote-write failed with status ${response.status}: ${respBody || "<empty body>"}`,
        );
        logger.warn(responseLog, "Remote-write returned retryable status");
      }
    } catch (error) {
      lastError = error;
      logger.warn(
        {
          attempt,
          maxAttempts: HTTP_MAX_ATTEMPTS,
          error: error instanceof Error ? error.message : error,
        },
        "Remote-write attempt failed",
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
    : new Error("Remote-write failed after retries");
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
