import { describe, expect, it, vi } from "vitest";
import { retryNonClientErrors } from "../../../scripts/send-message-batches/clients/retry-non-client-errors.js";

describe("retryNonClientErrors", () => {
  it("retries retryable non-4xx failures", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce({ status: 503 })
      .mockRejectedValueOnce({ code: "ETIMEDOUT" })
      .mockResolvedValue("ok");

    await expect(
      retryNonClientErrors(operation, {
        attempts: 3,
        baseDelayMs: 1,
        sleep: async () => undefined,
      }),
    ).resolves.toBe("ok");

    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("does not retry client-side failures", async () => {
    const operation = vi.fn().mockRejectedValue({ status: 400 });

    await expect(
      retryNonClientErrors(operation, {
        attempts: 3,
        baseDelayMs: 1,
        sleep: async () => undefined,
      }),
    ).rejects.toEqual({ status: 400 });

    expect(operation).toHaveBeenCalledTimes(1);
  });
});
