import type { LoggerAdapter } from "./logger-adapter.js";

type ConsoleLevel = "debug" | "info" | "warn" | "error";

function serializeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value.map((entry) => serializeValue(entry));
  }

  if (typeof value === "object" && value != null) {
    const serializedRecord: Record<string, unknown> = {};

    for (const [key, entryValue] of Object.entries(value)) {
      serializedRecord[key] = serializeValue(entryValue);
    }

    return serializedRecord;
  }

  return value;
}

function write(
  level: ConsoleLevel,
  fields: Record<string, unknown>,
  message: string,
): void {
  const fieldKeys = Object.keys(fields);

  if (fieldKeys.length === 0) {
    console[level](message);
    return;
  }

  console[level](`${message} ${JSON.stringify(serializeValue(fields))}`);
}

export function createConsoleLogger(): LoggerAdapter {
  return {
    debug() {
      // Suppress per-item debug noise in the operator console path.
    },
    info(fields, message) {
      write("info", fields, message);
    },
    warn(fields, message) {
      write("warn", fields, message);
    },
    error(fields, message) {
      write("error", fields, message);
    },
  };
}
