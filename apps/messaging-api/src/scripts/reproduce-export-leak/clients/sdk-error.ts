function getObjectRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value == null) {
    return null;
  }
  return value as Record<string, unknown>;
}

/**
 * Turns the SDK's loosely-typed `error` field into a readable message. Handles
 * the common `{ detail }` / `{ code }` envelope as well as raw string bodies
 * (returned when a proxy/WAF blocks the request).
 */
export function extractSdkErrorDetail(error: unknown): string {
  if (typeof error === "string") {
    return error.slice(0, 300).replace(/\s+/gu, " ").trim();
  }

  const record = getObjectRecord(error);
  if (record == null) {
    return "unknown SDK error";
  }

  const detail = record.detail;
  if (typeof detail === "string" && detail.length > 0) {
    return detail;
  }

  const code = record.code;
  if (typeof code === "string" && code.length > 0) {
    return code;
  }

  try {
    return JSON.stringify(record);
  } catch {
    return "unknown SDK error";
  }
}
