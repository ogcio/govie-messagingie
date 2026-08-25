import type { PoolClient } from "pg";

export const getJobTokenForProfileImport = async (
  client: PoolClient,
  id: string,
): Promise<string | undefined> => {
  const result = await client.query<{ job_token: string }>(
    "SELECT job_token FROM profile_imports WHERE id = $1;",
    [id],
  );

  return result.rows[0]?.job_token;
};
