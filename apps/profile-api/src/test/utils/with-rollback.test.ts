import type { PoolClient } from "pg";
import { describe, expect, it, vi } from "vitest";
import { withRollback } from "~/utils/with-rollback.js";

describe("withRollback", () => {
  const createMockClient = () => ({
    query: vi.fn(),
  });

  it("should execute transaction and commit on success", async () => {
    const mockClient = createMockClient();

    // Mock not in transaction initially
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ in_transaction: false }] }) // isInTransaction check
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({}) // callback query
      .mockResolvedValueOnce({}); // COMMIT

    const callback = vi.fn().mockResolvedValue("success");

    const result = await withRollback(
      mockClient as unknown as PoolClient,
      callback,
    );

    expect(result).toBe("success");
    expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
    expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
    expect(callback).toHaveBeenCalledWith(mockClient);
  });

  it("should rollback on error", async () => {
    const mockClient = createMockClient();

    // Mock not in transaction initially
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ in_transaction: false }] }) // isInTransaction check
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({}); // ROLLBACK

    const error = new Error("Operation failed");
    const callback = vi.fn().mockRejectedValue(error);

    await expect(
      withRollback(mockClient as unknown as PoolClient, callback),
    ).rejects.toThrow(error);

    expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
    expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
  });

  it("should skip transaction if already in one", async () => {
    const mockClient = createMockClient();

    // Mock already in transaction
    mockClient.query.mockResolvedValueOnce({
      rows: [{ in_transaction: true }],
    });

    const callback = vi.fn().mockResolvedValue("success");

    const result = await withRollback(
      mockClient as unknown as PoolClient,
      callback,
    );

    expect(result).toBe("success");
    expect(mockClient.query).not.toHaveBeenCalledWith("BEGIN");
    expect(mockClient.query).not.toHaveBeenCalledWith("COMMIT");
    expect(mockClient.query).not.toHaveBeenCalledWith("ROLLBACK");
  });

  it("should use a savepoint and release it on success when already in a transaction", async () => {
    const mockClient = createMockClient();
    mockClient.query.mockResolvedValue({});
    mockClient.query.mockResolvedValueOnce({
      rows: [{ in_transaction: true }],
    });

    const callback = vi.fn().mockResolvedValue("savepoint-success");

    const result = await withRollback(
      mockClient as unknown as PoolClient,
      callback,
    );

    expect(result).toBe("savepoint-success");
    const queries = mockClient.query.mock.calls.map((c) => c[0] as string);
    expect(queries.some((q) => q.startsWith("SAVEPOINT savepoint_"))).toBe(
      true,
    );
    expect(
      queries.some((q) => q.startsWith("RELEASE SAVEPOINT savepoint_")),
    ).toBe(true);
    expect(queries).not.toContain("BEGIN");
  });

  it("should roll back to the savepoint on error when already in a transaction", async () => {
    const mockClient = createMockClient();
    mockClient.query.mockResolvedValue({});
    mockClient.query.mockResolvedValueOnce({
      rows: [{ in_transaction: true }],
    });

    const error = new Error("savepoint failure");
    const callback = vi.fn().mockRejectedValue(error);

    await expect(
      withRollback(mockClient as unknown as PoolClient, callback),
    ).rejects.toThrow(error);

    const queries = mockClient.query.mock.calls.map((c) => c[0] as string);
    expect(
      queries.some((q) => q.startsWith("ROLLBACK TO SAVEPOINT savepoint_")),
    ).toBe(true);
    expect(
      queries.some((q) => q.startsWith("RELEASE SAVEPOINT savepoint_")),
    ).toBe(true);
  });

  it("should treat an empty transaction-status result as not in a transaction", async () => {
    const mockClient = createMockClient();
    mockClient.query.mockResolvedValue({});
    mockClient.query.mockResolvedValueOnce({ rows: [] });

    const callback = vi.fn().mockResolvedValue("ok");

    await withRollback(mockClient as unknown as PoolClient, callback);

    expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
    expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
  });

  it("should check transaction status correctly", async () => {
    const mockClient = createMockClient();

    mockClient.query.mockResolvedValueOnce({
      rows: [{ in_transaction: false }],
    });

    const callback = vi.fn().mockResolvedValue("success");

    await withRollback(mockClient as unknown as PoolClient, callback);

    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining("pg_current_xact_id_if_assigned()"),
    );
  });
});
