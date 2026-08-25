import { httpErrors } from "@fastify/sensible";

interface RetryConfig {
  maxRetries?: number;
  initialDelay?: number;
  timeout?: number;
  isRetryable?: (error: Error) => boolean;
}

export const withRetry = async <T>(
  operation: (signal: AbortSignal) => Promise<T>,
  config: RetryConfig = {},
): Promise<T> => {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    timeout = 5000,
    isRetryable = () => true,
  } = config;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      return await operation(controller.signal);
    } catch (error) {
      lastError = error as Error;
      if (!isRetryable(lastError) || attempt >= maxRetries - 1) {
        break;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, initialDelay * 2 ** attempt),
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw (
    lastError ||
    httpErrors.internalServerError(
      `Operation failed after ${maxRetries} retries`,
    )
  );
};
