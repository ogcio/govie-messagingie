import pg, { type Pool } from "pg";
import type { EnvDbConfig } from "../../plugins/external/env.js";
import { syncSummaryForMessage } from "../../services/messages/summary-event-logger.js";

function getPgConnection(envDbConfig: EnvDbConfig): Pool {
  return new pg.Pool({
    host: envDbConfig.POSTGRES_HOST,
    port: envDbConfig.POSTGRES_PORT,
    database: envDbConfig.POSTGRES_DB_NAME,
    user: envDbConfig.POSTGRES_USER,
    password: envDbConfig.POSTGRES_PASSWORD,
  });
}

export async function syncEventSummaryCommand(
  envDbConfig: EnvDbConfig,
  fullResync: boolean,
): Promise<void> {
  const pool = getPgConnection(envDbConfig);
  const batchSize = 500;

  try {
    const needSync = fullResync ? true : await needToSync(pool);
    if (!needSync) {
      console.log("Message event summary already synced");
      return;
    }
    console.log("Syncing message event summary");

    if (fullResync) {
      console.log("Full resync requested - truncating summary table");
      await pool.query("TRUNCATE TABLE message_event_summary;");
    }

    let offset = 0;
    let hasMore = true;

    // To avoid overflows we perform multiple transactions
    while (hasMore) {
      const messagingEventLogsQuery = `
        SELECT DISTINCT(message_id) as "messageId" 
        FROM messaging_event_logs 
        ORDER BY message_id
        LIMIT $1 
        OFFSET $2
      `;

      const messageEventLogsResult = await pool.query<{ messageId: string }>(
        messagingEventLogsQuery,
        [batchSize, offset],
      );

      if (messageEventLogsResult.rowCount === 0) {
        hasMore = false;
        continue;
      }

      console.log(
        `Processing batch of ${messageEventLogsResult.rowCount} messages starting at offset ${offset}`,
      );

      try {
        // Start transaction for current batch
        await pool.query("BEGIN;");

        const promises: Promise<void>[] = [];
        for (const messageEventMessage of messageEventLogsResult.rows) {
          console.log(
            `Syncing summary for message ${messageEventMessage.messageId}`,
          );
          promises.push(
            syncSummaryForMessage({
              messageId: messageEventMessage.messageId,
              pool,
            }),
          );

          if (promises.length >= 10) {
            console.log("Awaiting for insert to be executed...");
            await Promise.all(promises);
            promises.length = 0;
          }
        }

        // Process remaining promises in the batch
        if (promises.length > 0) {
          console.log(
            "Awaiting for insert to be executed at the end of the batch...",
          );
          await Promise.all(promises);
        }

        // Commit current batch
        await pool.query("COMMIT;");
        console.log(`Successfully committed batch at offset ${offset}`);
      } catch (err) {
        console.error(
          `Error processing batch at offset ${offset}, rolling back:`,
          err,
        );
        await pool.query("ROLLBACK;");
        throw err;
      }

      offset += batchSize;
    }

    console.log("Successfully completed message event summary sync");
  } catch (e) {
    console.error("Error while syncing event summary:", e);
    throw e;
  } finally {
    await pool.end();
  }
}

// If we already synced in past, we don't need to sync again
async function needToSync(pool: Pool): Promise<boolean> {
  const query = "SELECT id from message_event_summary LIMIT 1";

  const result = await pool.query(query);

  if (result.rowCount && result.rowCount > 0) {
    return false;
  }

  return true;
}
