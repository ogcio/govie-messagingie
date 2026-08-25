import type { Logger } from "../domain/types.js";

type ConsoleLevel = "info" | "warn" | "error";

function serializeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }

  if (Array.isArray(value)) {
    return value.map((entry) => serializeValue(entry));
  }

  if (typeof value === "object" && value != null) {
    const record: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value)) {
      record[key] = serializeValue(entryValue);
    }
    return record;
  }

  return value;
}

function write(
  level: ConsoleLevel,
  message: string,
  fields?: Record<string, unknown>,
): void {
  if (fields == null || Object.keys(fields).length === 0) {
    console[level](message);
    return;
  }

  console[level](`${message} ${JSON.stringify(serializeValue(fields))}`);
}

export function createConsoleLogger(): Logger {
  return {
    info(message, fields) {
      write("info", message, fields);
    },
    warn(message, fields) {
      write("warn", message, fields);
    },
    error(message, fields) {
      write("error", message, fields);
    },
  };
}
