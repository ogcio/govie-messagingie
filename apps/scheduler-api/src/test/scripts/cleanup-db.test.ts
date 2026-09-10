import type { Pool } from "pg";
import type { Logger } from "pino";
import { describe, expect, test, vi } from "vitest";
import { cleanupDb } from "../../scripts/cleanup-db.js";

const BATCH_SIZE = 1000;

const buildLogger = () =>
  ({ info: vi.fn(), error: vi.fn() }) as unknown as Logger;

const buildPool = (query: ReturnType<typeof vi.fn>) => {
  const release = vi.fn();
  const pool = {
    connect: vi.fn().mockResolvedValue({ query, release }),
  } as unknown as Pool;
  return { pool, release };
};

const rowsOfIds = (count: number, prefix: string) =>
  Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i}` }));

describe("cleanupDb", () => {
  test("throws on a non-integer retentionDays without touching the db", async () => {
    const query = vi.fn();
    const { pool } = buildPool(query);

    await expect(cleanupDb(pool, 1.5, buildLogger())).rejects.toThrow(
      "Invalid retentionDays",
    );
    expect(pool.connect).not.toHaveBeenCalled();
  });

  test("returns 0 and commits when there is nothing to delete", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // SELECT
      .mockResolvedValueOnce(undefined); // COMMIT
    const { pool, release } = buildPool(query);

    const deleted = await cleanupDb(pool, 30, buildLogger());

    expect(deleted).toBe(0);
    expect(query).toHaveBeenCalledWith("COMMIT");
    expect(release).toHaveBeenCalled();
  });

  test("deletes in batches until a short batch signals the end", async () => {
    const selectBatches = [rowsOfIds(BATCH_SIZE, "a"), rowsOfIds(2, "b")];
    const query = vi.fn().mockImplementation((sql: string) => {
      const s = String(sql);
      if (s.startsWith("SELECT")) {
        return Promise.resolve({ rows: selectBatches.shift() ?? [] });
      }
      if (s.startsWith("DELETE FROM scheduled_events")) {
        return Promise.resolve({
          rowCount: selectBatches.length === 1 ? BATCH_SIZE : 2,
        });
      }
      return Promise.resolve({ rowCount: 0, rows: [] });
    });
    const { pool, release } = buildPool(query);

    const deleted = await cleanupDb(pool, 30, buildLogger());

    expect(deleted).toBe(BATCH_SIZE + 2);
    const sqls = query.mock.calls.map(([s]) => String(s));
    expect(sqls.filter((s) => s.startsWith("SELECT"))).toHaveLength(2);
    expect(sqls.filter((s) => s.includes("event_logs"))).toHaveLength(2);
    expect(release).toHaveBeenCalled();
  });

  test("passes retention cutoff and delivered status to the select", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // SELECT
      .mockResolvedValueOnce(undefined); // COMMIT
    const { pool } = buildPool(query);

    const before = Date.now();
    await cleanupDb(pool, 30, buildLogger());
    const after = Date.now();

    const selectCall = query.mock.calls.find(([s]) =>
      String(s).startsWith("SELECT"),
    );
    expect(selectCall).toBeDefined();
    const [, params] = selectCall as [string, [string, Date, number]];
    expect(params[0]).toBe("delivered");
    expect(params[2]).toBe(BATCH_SIZE);
    const cutoff = params[1].getTime();
    const oneDayMs = 86400000;
    expect(cutoff).toBeGreaterThanOrEqual(before - 30 * oneDayMs);
    expect(cutoff).toBeLessThanOrEqual(after - 30 * oneDayMs);
  });

  test("rolls back, logs, rethrows, and releases on failure", async () => {
    const boom = new Error("db exploded");
    const query = vi.fn().mockImplementation((sql: string) => {
      if (String(sql).startsWith("SELECT")) return Promise.reject(boom);
      return Promise.resolve({ rows: [], rowCount: 0 });
    });
    const { pool, release } = buildPool(query);
    const logger = buildLogger();

    await expect(cleanupDb(pool, 30, logger)).rejects.toThrow("db exploded");
    expect(query).toHaveBeenCalledWith("ROLLBACK");
    expect(logger.error).toHaveBeenCalled();
    expect(release).toHaveBeenCalled();
  });

  test("swallows rollback failures and still rethrows the original error", async () => {
    const boom = new Error("original");
    const query = vi.fn().mockImplementation((sql: string) => {
      const s = String(sql);
      if (s.startsWith("SELECT")) return Promise.reject(boom);
      if (s === "ROLLBACK") return Promise.reject(new Error("rollback failed"));
      return Promise.resolve({ rows: [], rowCount: 0 });
    });
    const { pool, release } = buildPool(query);

    await expect(cleanupDb(pool, 30, buildLogger())).rejects.toThrow(
      "original",
    );
    expect(release).toHaveBeenCalled();
  });
});
