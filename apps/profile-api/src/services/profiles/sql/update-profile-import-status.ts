import type { PoolClient } from "pg";

export const updateProfileImportStatus = async (
  client: PoolClient,
  profileImportId: string,
  status = "failed",
): Promise<void> => {
  await client.query(
    "UPDATE profile_imports SET status = $1, updated_at = NOW() WHERE id = $2;",
    [status, profileImportId],
  );
};
