import { describe, expect, it, vi } from "vitest";
import {
  TimeoutError,
  withTimeout,
} from "~/scripts/lifecycle-worker/with-timeout.js";

describe("withTimeout", () => {
  it("resolves with the value when the promise settles before the timeout", async () => {
    const result = await withTimeout(Promise.resolve("ok"), 1000, "fast");
    expect(result).toBe("ok");
  });

  it("rejects with TimeoutError when the timeout fires first", async () => {
    const never = new Promise<string>(() => {});
    await expect(withTimeout(never, 10, "slow")).rejects.toBeInstanceOf(
      TimeoutError,
    );
  });

  it("invokes onTimeout exactly once when the timeout fires", async () => {
    const onTimeout = vi.fn();
    const never = new Promise<string>(() => {});
    await expect(
      withTimeout(never, 10, "slow", onTimeout),
    ).rejects.toBeInstanceOf(TimeoutError);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("does not invoke onTimeout when the promise resolves in time", async () => {
    const onTimeout = vi.fn();
    await withTimeout(Promise.resolve(1), 1000, "fast", onTimeout);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("propagates the original rejection reason", async () => {
    const boom = new Error("boom");
    await expect(withTimeout(Promise.reject(boom), 1000, "err")).rejects.toBe(
      boom,
    );
  });

  it("exposes the label and timeout on the TimeoutError", async () => {
    const never = new Promise<string>(() => {});
    await withTimeout(never, 5, "labelled").catch((error: unknown) => {
      expect(error).toBeInstanceOf(TimeoutError);
      const timeoutError = error as TimeoutError;
      expect(timeoutError.label).toBe("labelled");
      expect(timeoutError.timeoutMs).toBe(5);
    });
  });
});
