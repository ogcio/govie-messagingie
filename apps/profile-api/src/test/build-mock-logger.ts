import type { PinoLoggerOptions } from "fastify/types/logger.js";
import { pino } from "pino";

export const buildMockLogger = (loggerConfiguration: PinoLoggerOptions) => {
  const { loggerDestination, getLoggedRecords } = getTestingDestinationLogger();

  return {
    logger: pino(loggerConfiguration, loggerDestination),
    loggedRecordsMethod: getLoggedRecords,
  };
};

interface TestingLoggerDestination {
  loggerDestination: {
    write: (_data: string) => number;
  };
  getLoggedRecords: () => string[];
}

const getTestingDestinationLogger = (): TestingLoggerDestination => {
  const testCaseRecords: string[] = [];
  const getLoggedRecords = () => testCaseRecords;
  const loggerDestination = {
    write: (data: string) => testCaseRecords.push(data),
  };

  return { loggerDestination, getLoggedRecords };
};
