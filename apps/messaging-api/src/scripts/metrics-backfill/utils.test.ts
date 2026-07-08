import { afterEach, describe, expect, it, vi } from "vitest";
import { postWithRetry } from "./utils.js";

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("postWithRetry", () => {
  it("does not retry non-retryable remote-write statuses", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      headers: new Headers(),
      ok: false,
      status: 400,
      text: vi.fn(async () => "bad request"),
    } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    const result = postWithRetry(
      new Uint8Array([1, 2, 3]),
      { "Content-Type": "application/x-protobuf" },
      logger as never,
      "http://collector.example/write",
      async () => undefined,
    );
    const rejection = expect(result).rejects.toThrow(
      "Remote-write failed with non-retryable status 400: bad request",
    );
    await vi.runAllTimersAsync();

    await rejection;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
