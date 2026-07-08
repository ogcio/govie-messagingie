import protobuf from "protobufjs";
import { compress, uncompress } from "snappyjs";
import {
  BACKFILL_POD,
  METRIC_DEPLOYMENT,
  METRIC_JOB,
  METRIC_NAME,
  METRIC_NORMALIZATION_APPLIED,
  MS_PER_DAY,
} from "./constants.js";
import type { DailyCount } from "./utils.js";

// Minimal Prometheus remote-write v1 schema (prometheus/prompb/remote.proto).
// Sample.timestamp is unix milliseconds; value is a float64.
const root = protobuf.Root.fromJSON({
  nested: {
    prometheus: {
      nested: {
        WriteRequest: {
          fields: {
            timeseries: { rule: "repeated", type: "TimeSeries", id: 1 },
          },
        },
        TimeSeries: {
          fields: {
            labels: { rule: "repeated", type: "Label", id: 1 },
            samples: { rule: "repeated", type: "Sample", id: 2 },
          },
        },
        Label: {
          fields: {
            name: { type: "string", id: 1 },
            value: { type: "string", id: 2 },
          },
        },
        Sample: {
          fields: {
            value: { type: "double", id: 1 },
            timestamp: { type: "int64", id: 2 },
          },
        },
      },
    },
  },
});
const WriteRequest = root.lookupType("prometheus.WriteRequest");

export type Label = { name: string; value: string };
export type Series = { labels: Label[]; value: number; timestampMs: number };

// Labels must be sorted by name (byte order) for Mimir to accept them.
export function seriesForRow(
  row: DailyCount,
  namespace: string,
  cluster: string,
): Series {
  const labels: Label[] = [
    { name: "__name__", value: METRIC_NAME },
    { name: "cluster", value: cluster },
    { name: "deployment", value: METRIC_DEPLOYMENT },
    { name: "job", value: METRIC_JOB },
    { name: "namespace", value: namespace },
    { name: "organizationId", value: row.organizationId },
    {
      name: "otlp_attribute_normalization_applied",
      value: METRIC_NORMALIZATION_APPLIED,
    },
    { name: "pod", value: BACKFILL_POD },
  ].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  return {
    labels,
    // Monotonic running total (from SQL), stamped at end-of-day, so
    // increase()/rate() recover each day's count as the delta.
    value: row.cumulative,
    timestampMs: row.day.getTime() + MS_PER_DAY,
  };
}

function encodeWriteRequest(series: Series[]): Uint8Array {
  const message = {
    timeseries: series.map((s) => ({
      labels: s.labels,
      samples: [{ value: s.value, timestamp: s.timestampMs }],
    })),
  };
  const err = WriteRequest.verify(message);
  if (err) {
    throw new Error(`Invalid remote-write payload: ${err}`);
  }
  return compress(WriteRequest.encode(message).finish());
}

export function buildRemoteWriteBody(
  dayRows: DailyCount[],
  namespace: string,
  cluster: string,
): Uint8Array {
  return encodeWriteRequest(
    dayRows.map((row) => seriesForRow(row, namespace, cluster)),
  );
}

// Test/debug helper: reverse buildRemoteWriteBody back to a plain object.
export function decodeWriteRequest(compressed: Uint8Array): {
  timeseries: {
    labels: Label[];
    samples: { value: number; timestamp: number }[];
  }[];
} {
  const decoded = WriteRequest.decode(uncompress(compressed));
  // biome-ignore lint/suspicious/noExplicitAny: protobufjs toObject is untyped
  return WriteRequest.toObject(decoded, { longs: Number }) as any;
}
