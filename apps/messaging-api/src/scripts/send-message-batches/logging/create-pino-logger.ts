import pino from "pino";
import type { LoggerAdapter } from "./logger-adapter.js";

export function createPinoLogger(): LoggerAdapter {
  const logger = pino();

  return {
    debug(fields, message) {
      logger.debug(fields, message);
    },
    info(fields, message) {
      logger.info(fields, message);
    },
    warn(fields, message) {
      logger.warn(fields, message);
    },
    error(fields, message) {
      logger.error(fields, message);
    },
  };
}
