import { getMetric } from "@ogcio/o11y-sdk-node";
import type { FastifyBaseLogger } from "fastify";
import type { Pool } from "pg";
import { getPendingJobPerOrganization } from "../services/jobs/job-service.js";

/// Metric to track the number of messages sent, tagged by organization ID.
export const messagesSentCounter = getMetric<
  "counter",
  { organizationId: string }
>("counter", {
  meterName: "message_delivery",
  metricName: "messages_sent",
});

/// Metric to track the number of messages read.
export const messagesReadCounter = getMetric<"counter">("counter", {
  meterName: "message_delivery",
  metricName: "messages_read",
});

/// Metric to track the number of messages created, tagged by organization ID.
export const messagesCreatedCounter = getMetric<
  "counter",
  { organizationId: string }
>("counter", {
  meterName: "message_delivery",
  metricName: "messages_created",
});

export const messagesQueueGauge = getMetric<
  "gauge",
  { organizationId: string }
>("gauge", {
  meterName: "message_delivery",
  metricName: "messages_queued",
});

/// Metric to track the number of messages queued, tagged by organization ID.
export const setupAsyncMetrics = (pool: Pool, logger: FastifyBaseLogger) => {
  // Gauge to track the number of messages currently queued, tagged by organization ID.
  getMetric<"async-gauge", { organizationId: string }>("async-gauge", {
    metricName: "messages_queued",
    meterName: "message_delivery",
  }).addCallback(async (observer) => {
    const pendingJobs = await getPendingJobPerOrganization({
      pool,
      logger,
    });
    pendingJobs.forEach((job) => {
      observer.observe(job.counter, {
        organizationId: job.organizationId,
      });
    });
  });
};
