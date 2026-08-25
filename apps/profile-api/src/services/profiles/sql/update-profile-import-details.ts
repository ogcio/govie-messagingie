import type { PoolClient } from "pg";

export const updateProfileImportDetails = async (
  client: PoolClient,
  importDetailsIdList: string[],
  error: string,
  status = "failed",
): Promise<void> => {
  if (importDetailsIdList.length === 0) {
    return;
  }

  const placeholders = importDetailsIdList
    .map((_, index) => `$${index + 3}`)
    .join(",");

  await client.query(
    `UPDATE profile_import_details SET error_message = $1, status = $2, updated_at = NOW() WHERE id IN (${placeholders});`,
    [error, status, ...importDetailsIdList],
  );
};
