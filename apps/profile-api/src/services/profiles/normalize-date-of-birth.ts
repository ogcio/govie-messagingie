import type { Pool } from "pg";
import type { Logger } from "pino";
import { isISODate, toIsoDate } from "~/utils/dates.js";
import { withClient } from "~/utils/with-client.js";
import {
  bulkUpdateProfileDataValues,
  selectDateOfBirthProfileData,
} from "./sql/normalize-date-of-birth-data.js";

const BATCH_SIZE = 100;

export const normalizeDateOfBirth = async (params: {
  pool: Pool;
  logger: Logger;
}): Promise<void> => {
  const { pool, logger } = params;

  let offset = 0;
  let totalProcessed = 0;
  let totalUpdated = 0;

  logger.info("Starting date-of-birth normalization");

  await withClient(pool, async (client) => {
    let hasMore = true;
    while (hasMore) {
      const rows = await selectDateOfBirthProfileData({
        client,
        limit: BATCH_SIZE,
        offset,
      });

      if (rows.length === 0) {
        hasMore = false;
        continue;
      }

      logger.info(
        { offset, count: rows.length },
        "Processing batch of date-of-birth values",
      );

      const updates: Array<{ id: string; value: string }> = [];

      for (const row of rows) {
        if (isISODate(row.value)) {
          continue;
        }

        let normalized: string;
        try {
          normalized = toIsoDate(row.value);
        } catch (err) {
          logger.warn(
            { id: row.id, value: row.value, err },
            "Failed to normalize date-of-birth value, skipping",
          );
          continue;
        }

        updates.push({ id: row.id, value: normalized });
      }

      if (updates.length > 0) {
        await bulkUpdateProfileDataValues({ client, updates });

        logger.info(
          { updated: updates.length },
          "Updated date-of-birth values in batch",
        );

        totalUpdated += updates.length;
      }

      totalProcessed += rows.length;
      offset += rows.length;

      if (rows.length < BATCH_SIZE) {
        hasMore = false;
      }
    }
  });

  logger.info(
    { totalProcessed, totalUpdated },
    "Finished date-of-birth normalization",
  );
};
