import v8 from "node:v8";
import fastifyUnderPressure from "@fastify/under-pressure";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

// Check if we're in a test environment
const isTestEnv =
  process.env.NODE_ENV === "test" || process.env.DATABASE_TEST_URL;

// Production configuration
const productionConfig = {
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

// Export configuration based on environment
export const autoConfig = isTestEnv ? {} : productionConfig;

// Export the appropriate plugin based on environment
export default isTestEnv
  ? async function noOpUnderPressure(_fastify: FastifyInstance) {
      // Do nothing - disable under-pressure in tests
      return;
    }
  : fastifyUnderPressure;
