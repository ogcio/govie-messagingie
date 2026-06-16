const RETRYABLE_STATUS_CODES = new Set([502, 503, 504]);
const RETRYABLE_ERROR_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
]);

function getObjectRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value == null) {
    return null;
  }

  return value as Record<string, unknown>;
}

function getNumericField(
  value: Record<string, unknown>,
  fieldName: string,
): number | undefined {
  const fieldValue = value[fieldName];
  return typeof fieldValue === "number" ? fieldValue : undefined;
}

function getStringField(
  value: Record<string, unknown>,
  fieldName: string,
): string | undefined {
  const fieldValue = value[fieldName];
  return typeof fieldValue === "string" ? fieldValue : undefined;
}

function getStatus(error: unknown): number | undefined {
  const errorRecord = getObjectRecord(error);
  if (errorRecord == null) {
    return undefined;
  }

  return (
    getNumericField(errorRecord, "status") ??
    getNumericField(errorRecord, "statusCode") ??
    getStatus(errorRecord.response) ??
    getStatus(errorRecord.cause)
  );
}

function getCode(error: unknown): string | undefined {
  const errorRecord = getObjectRecord(error);
  if (errorRecord == null) {
    return undefined;
  }

  return getStringField(errorRecord, "code") ?? getCode(errorRecord.cause);
}

export function isRetryableNonClientError(error: unknown): boolean {
  const status = getStatus(error);
  if (typeof status === "number") {
    if (status >= 400 && status < 500) {
      return false;
    }

    return RETRYABLE_STATUS_CODES.has(status);
  }

  const code = getCode(error);
  if (typeof code === "string") {
    return RETRYABLE_ERROR_CODES.has(code);
  }

  return false;
}

export async function retryNonClientErrors<T>(
  operation: () => Promise<T>,
  params?: {
    attempts?: number;
    baseDelayMs?: number;
    sleep?: (delayMs: number) => Promise<void>;
  },
): Promise<T> {
  const attempts = params?.attempts ?? 3;
  const baseDelayMs = params?.baseDelayMs ?? 250;
  const sleep =
    params?.sleep ??
    ((delayMs: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, delayMs);
      }));

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isRetryableNonClientError(error) || attempt === attempts) {
        throw error;
      }

      await sleep(baseDelayMs * attempt);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("retryNonClientErrors exhausted without a terminal error");
}
