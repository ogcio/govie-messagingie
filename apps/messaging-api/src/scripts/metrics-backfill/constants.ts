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

// Query the DB, build payloads, log them, but don't POST anything. Run once
// with DRY_RUN=true and eyeball the per-day totals before flipping to false.
export const DRY_RUN = true;

// Throttle between per-day POSTs. 0 = back-to-back.
export const PER_REQUEST_DELAY_MS = 1000;

// Resource attributes attached to every backfilled data point. These MUST
// match the resource block emitted by the live messaging-api so backfill
// points land in the same time series as live points — otherwise dashboards
// will show two parallel streams.
//
// TODO: populate from the live collector's debug exporter (coordinate with
// the Observability team). Typical fields: service.name, service.namespace,
// deployment.environment, k8s.cluster.name, etc.
export const RESOURCE_ATTRIBUTES: {
  key: string;
  value: { stringValue: string };
}[] = [{ key: "service.name", value: { stringValue: "messaging-api-server" } }];

// OTLP transport tuning.
export const HTTP_TIMEOUT_MS = 30_000;
export const HTTP_MAX_ATTEMPTS = 5;
export const HTTP_BACKOFF_BASE_MS = 1_000;

// =============================================================================
// Below this line: implementation. No further configuration.
// =============================================================================

// OTLP Sum aggregationTemporality. 2 = CUMULATIVE — matches the live
// messages_sent Counter exported by the o11y SDK. Do not mix temporalities
// for the same metric stream.
export const AGGREGATION_TEMPORALITY_CUMULATIVE = 2;

export const NANOS_PER_MS = 1_000_000n;
export const MS_PER_DAY = 86_400_000;
