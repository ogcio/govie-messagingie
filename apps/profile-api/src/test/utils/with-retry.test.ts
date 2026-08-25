import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withRetry } from "~/utils/with-retry.js";

describe("withRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return result on successful operation", async () => {
    const operation = vi.fn().mockResolvedValue("success");

    const result = await withRetry(operation);

    expect(result).toBe("success");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("should retry on failure", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error("First fail"))
      .mockRejectedValueOnce(new Error("Second fail"))
      .mockResolvedValue("success");

    const promise = withRetry(operation, { initialDelay: 100 });

    // Fast-forward through retries
    for (let i = 0; i < 2; i++) {
      await vi.runAllTimersAsync();
    }

    const result = await promise;

    expect(result).toBe("success");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("should respect maxRetries config", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("Always fail"));
    const retryCount = 2;

    const promise = withRetry(operation, {
      maxRetries: retryCount,
      initialDelay: 100,
    });
    // Attach a catch handler immediately to avoid unhandled rejections
    promise.catch(() => {});

    // Advance all timers to trigger the retries
    await vi.runAllTimersAsync();

    // Use a single assertion on the promise to avoid unhandled rejections
    await expect(promise).rejects.toThrow("Always fail");

    expect(operation).toHaveBeenCalledTimes(retryCount);
  });

  it("should handle timeout", async () => {
    const operation = vi.fn().mockImplementation(
      (signal: AbortSignal) =>
        new Promise((_, reject) => {
          signal.addEventListener("abort", () => {
            reject(new Error("AbortError"));
          });
        }),
    );

    const promise = withRetry(operation, {
      timeout: 100,
      maxRetries: 1,
      initialDelay: 50,
    });

    await vi.runOnlyPendingTimers();

    await expect(promise).rejects.toThrow("AbortError");
    expect(operation).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it("should use exponential backoff", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error("First fail"))
      .mockRejectedValueOnce(new Error("Second fail"))
      .mockResolvedValue("success");

    const promise = withRetry(operation, { initialDelay: 100 });

    // Check delay increases exponentially
    await vi.advanceTimersByTimeAsync(100); // First retry
    expect(operation).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(200); // Second retry
    expect(operation).toHaveBeenCalledTimes(3);

    await promise;
  });

  it("should pass abort signal to operation", async () => {
    const operation = vi.fn().mockImplementation((signal: AbortSignal) => {
      expect(signal).toBeInstanceOf(AbortSignal);
      return Promise.resolve("success");
    });

    await withRetry(operation);

    expect(operation).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it("should not retry when isRetryable returns false", async () => {
    class NonRetryableError extends Error {
      constructor(public status: number) {
        super("Non-retryable");
      }
    }

    const operation = vi.fn().mockRejectedValue(new NonRetryableError(400));

    const promise = withRetry(operation, {
      initialDelay: 100,
      isRetryable: (error) =>
        !(error instanceof NonRetryableError && error.status < 500),
    });

    await expect(promise).rejects.toThrow("Non-retryable");
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
