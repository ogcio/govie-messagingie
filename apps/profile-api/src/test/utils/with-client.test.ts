import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { withClient } from "~/utils/with-client.js";

describe("withClient", () => {
  it("should execute callback with client", async () => {
    const mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
    };

    const callback = vi.fn().mockResolvedValue("result");

    const result = await withClient(mockPool as unknown as Pool, callback);

    expect(result).toBe("result");
    expect(mockPool.connect).toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(mockClient);
  });

  it("should handle database errors", async () => {
    const mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
    };

    const dbError = new Error("Database error");
    const callback = vi.fn().mockRejectedValue(dbError);

    await expect(
      withClient(mockPool as unknown as Pool, callback),
    ).rejects.toThrow("Database error");
  });

  it("should handle connection errors", async () => {
    const mockPool = {
      connect: vi.fn().mockRejectedValue(new Error("Connection failed")),
    };

    await expect(
      withClient(mockPool as unknown as Pool, vi.fn()),
    ).rejects.toThrow("Connection failed");
  });
});
