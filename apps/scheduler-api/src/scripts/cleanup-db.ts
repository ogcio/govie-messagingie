import type { Pool } from "pg";
import type { Logger } from "pino";

const BATCH_SIZE = 1000;

export async function cleanupDb(
  pool: Pool,
  retentionDays: number,
  logger: Logger,
) {
  if (!Number.isInteger(retentionDays)) {
    throw new Error("Invalid retentionDays");
  }
  const client = await pool.connect();
  logger.info(
    { retentionDays },
    "Starting database cleanup for scheduled events and event logs",
  );

  try {
    let totalDeleted = 0;
    let hasMore = true;

    while (hasMore) {
      await client.query("BEGIN");
      logger.info("Starting a new batch deletion");
      const oneDayMs = 86400000;
      const cutoff = new Date(Date.now() - retentionDays * oneDayMs);
      const { rows } = await client.query(
        `SELECT id FROM scheduled_events
         WHERE event_status = $1
           AND updated_at < $2
         LIMIT $3`,
        ["delivered", cutoff, BATCH_SIZE],
      );

      if (rows.length === 0) {
        logger.info("No more rows to delete");
        await client.query("COMMIT");
        break;
      }

      logger.info(
        { batchSize: rows.length },
        "Fetched batch of events to delete",
      );
      const ids = rows.map((r: { id: string }) => r.id);

      await client.query("DELETE FROM event_logs WHERE event_id = ANY($1)", [
        ids,
      ]);

      logger.info({ batchSize: rows.length }, "Deleted event logs for batch");

      const result = await client.query(
        "DELETE FROM scheduled_events WHERE id = ANY($1)",
        [ids],
      );

      await client.query("COMMIT");
      logger.info(
        { batchSize: rows.length },
        "Deleted scheduled events for batch",
      );

      totalDeleted += result.rowCount ?? 0;
      hasMore = rows.length === BATCH_SIZE;
    }

    logger.info({ totalDeleted }, "Completed database cleanup");

    return totalDeleted;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    logger.error({ err }, "Error occurred during database cleanup");
    throw err;
  } finally {
    client.release();
  }
}
