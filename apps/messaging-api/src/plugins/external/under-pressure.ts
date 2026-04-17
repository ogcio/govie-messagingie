import v8 from "node:v8";
import fastifyUnderPressure from "@fastify/under-pressure";
import type { FastifyReply, FastifyRequest } from "fastify";

export const autoConfig = {
  maxEventLoopDelay: 1000,
  maxHeapUsedBytes: v8.getHeapStatistics().heap_size_limit,
  maxRssBytes: v8.getHeapStatistics().total_available_size,
  maxEventLoopUtilization: 0.98,
  pressureHandler: (
    _req: FastifyRequest,
    rep: FastifyReply,
    type: string,
    value: number | string | undefined | null,
  ) => {
    throw rep.serviceUnavailable(
      `System is under pressure. Pressure type: ${type}. Pressure value: ${value}`,
    );
  },
};

export default fastifyUnderPressure;
