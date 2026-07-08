import { describe, expect, it } from "vitest";
import { MS_PER_DAY } from "./constants.js";
import {
  buildRemoteWriteBody,
  decodeWriteRequest,
  seriesForRow,
} from "./remote-write.js";
import type { DailyCount } from "./utils.js";

const row = (
  organizationId: string,
  day: string,
  counter: number,
  cumulative: number,
): DailyCount => ({
  organizationId,
  day: new Date(`${day}T00:00:00.000Z`),
  counter,
  cumulative,
});

describe("seriesForRow", () => {
  it("emits exactly the expected label set, sorted by name", () => {
    const { labels } = seriesForRow(
      row("acp", "2026-01-15", 5, 42),
      "ns-dev",
      "non-prod-02",
    );
    expect(labels.map((l) => l.name)).toEqual([
      "__name__",
      "cluster",
      "deployment",
      "job",
      "namespace",
      "organizationId",
      "otlp_attribute_normalization_applied",
      "pod",
    ]);
    expect(Object.fromEntries(labels.map((l) => [l.name, l.value]))).toEqual({
      __name__: "messages_sent_total",
      cluster: "non-prod-02",
      deployment: "messaging-api",
      job: "messaging-api-server",
      namespace: "ns-dev",
      organizationId: "acp",
      otlp_attribute_normalization_applied: "true",
      pod: "messaging-api-backfill",
    });
  });

  it("writes the cumulative value at end-of-day (next-day 00:00 UTC)", () => {
    const s = seriesForRow(row("acp", "2026-01-15", 5, 42), "ns", "c");
    expect(s.value).toBe(42);
    expect(s.timestampMs).toBe(new Date("2026-01-16T00:00:00.000Z").getTime());
    expect(s.timestampMs).toBe(
      new Date("2026-01-15T00:00:00.000Z").getTime() + MS_PER_DAY,
    );
  });
});

describe("buildRemoteWriteBody", () => {
  it("round-trips through snappy+protobuf back to the same series", () => {
    const rows = [
      row("acp", "2026-01-15", 5, 5),
      row("dsp", "2026-01-15", 3, 3),
    ];
    const decoded = decodeWriteRequest(
      buildRemoteWriteBody(rows, "ns-prod", "prod-02"),
    );

    expect(decoded.timeseries).toHaveLength(2);
    const acp = decoded.timeseries.find((t) =>
      t.labels.some((l) => l.name === "organizationId" && l.value === "acp"),
    );
    expect(acp).toBeDefined();
    expect(acp?.samples).toHaveLength(1);
    expect(acp?.samples[0].value).toBe(5);
    expect(acp?.samples[0].timestamp).toBe(
      new Date("2026-01-16T00:00:00.000Z").getTime(),
    );
    expect(acp?.labels.find((l) => l.name === "namespace")?.value).toBe(
      "ns-prod",
    );
    expect(acp?.labels.find((l) => l.name === "cluster")?.value).toBe(
      "prod-02",
    );
  });

  it("preserves a large running cumulative exactly", () => {
    const big = 9_000_000_000; // > 2^32, well within float64 integer range
    const decoded = decodeWriteRequest(
      buildRemoteWriteBody([row("acp", "2026-02-01", 10, big)], "ns", "c"),
    );
    expect(decoded.timeseries[0].samples[0].value).toBe(big);
  });
});
