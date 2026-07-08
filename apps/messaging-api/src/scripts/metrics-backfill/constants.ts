// Upper bound (exclusive). messages_sent has been emitted programmatically
// from 2026-02-26 onwards, so anything from that day forward is already in
// Grafana.
export const UPPER_DATE = "2026-02-26";

// Lower bound (inclusive). Set after a partial run to resume — the previous
// run's logs print the exact value to use here as `lastCompletedDay + 1`.
// Leave undefined to backfill from the earliest event_log entry.
export const LOWER_DATE: string | undefined = undefined;

// Restrict to a single organisation. Useful for a smoke test before the full
// run. Leave undefined to backfill all orgs.
export const ORGANIZATION_ID: string | undefined = undefined;

// Query the DB, build payloads, log them, but don't POST anything. Defaults to
// a dry run for safety (this writes to shared Mimir): only
// METRICS_BACKFILL_DRY_RUN=false actually remote-writes. Eyeball the per-day
// cumulative totals on a dry run first, then flip to false.
export const DRY_RUN = process.env.METRICS_BACKFILL_DRY_RUN !== "false";

// Throttle between per-day POSTs. 0 = back-to-back.
export const PER_REQUEST_DELAY_MS = 1000;

// Labels read back from a live prod sample so backfill merges into that series.
// The `_total` suffix and the otlp_attribute_normalization_applied label are
// added by the central Alloy on every live point — don't drop them.
export const METRIC_NAME = "messages_sent_total";
export const METRIC_JOB = "messaging-api-server";
export const METRIC_DEPLOYMENT = "messaging-api";
export const METRIC_NORMALIZATION_APPLIED = "true";

// Per-env, so dev/prod points land on their own live series.
export const K8S_NAMESPACE = process.env.METRICS_BACKFILL_NAMESPACE;

// The live metric has no cluster label (cluster is a resource attr → target_info),
// so adding one forks a distinct series. Deliberate; set per-env.
export const CLUSTER = process.env.METRICS_BACKFILL_CLUSTER;

// Sentinel: pods rotate per deploy so there's no real historical value. Keeps
// the label present for pod-grouped queries; dashboards sum over pod anyway.
export const BACKFILL_POD = "messaging-api-backfill";

export const REMOTE_WRITE_HEADERS: Record<string, string> = {
  "Content-Type": "application/x-protobuf",
  "Content-Encoding": "snappy",
  "X-Prometheus-Remote-Write-Version": "0.1.0",
};

// HTTP transport tuning.
export const HTTP_TIMEOUT_MS = 30_000;
export const HTTP_MAX_ATTEMPTS = 5;
export const HTTP_BACKOFF_BASE_MS = 1_000;

export const MS_PER_DAY = 86_400_000;

// Auth is OPTIONAL: if no app id/secret is configured (e.g. a local collector
// on localhost:4318), the backfill POSTs without an Authorization header.
export const LOGTO_OIDC_ENDPOINT = process.env.LOGTO_OIDC_ENDPOINT ?? "";
export const COLLECTOR_TOKEN_APP_ID = process.env.O11Y_ALLOY_CLIENT_ID ?? "";
export const COLLECTOR_TOKEN_APP_SECRET =
  process.env.O11Y_ALLOY_CLIENT_SECRET ?? "";

export const TOKEN_EXPIRY_SKEW_MS = 30_000;
