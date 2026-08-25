import type { PoolClient } from "pg";

export const updateProfileImportDetailsStatus = async (
  client: PoolClient,
  importDetailsIdList: string[],
  status: string,
): Promise<{ id: string; status: string }[]> => {
  const placeholders = importDetailsIdList
    .map((_, index) => `$${index + 2}`)
    .join(",");

  if (importDetailsIdList.length === 0) {
    return [];
  }

  const result = await client.query<{ id: string; status: string }>(
    `UPDATE profile_import_details SET status = $1, updated_at = NOW() WHERE id IN (${placeholders}) RETURNING id, status;`,
    [status, ...importDetailsIdList],
  );

  return result.rows;
};
