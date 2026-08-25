import type { PoolClient } from "pg";

export const updateProfileImportDetailsBatchNumber = async (
  client: PoolClient,
  importDetailsIdList: string[],
  batchNumber: number,
): Promise<{ id: string; batch: number }[]> => {
  const placeholders = importDetailsIdList
    .map((_, index) => `$${index + 2}`)
    .join(",");

  const result = await client.query<{ id: string; batch: number }>(
    `UPDATE profile_import_details SET batch_number = $1, updated_at = NOW() WHERE id IN (${placeholders}) RETURNING id, batch_number as batch;`,
    [batchNumber, ...importDetailsIdList],
  );

  return result.rows;
};
