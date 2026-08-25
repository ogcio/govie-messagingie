import type { PoolClient } from "pg";

export const checkIfProfileExists = async (
  client: PoolClient,
  profileId: string,
): Promise<boolean> => {
  const { rows } = await client.query<{ id: string }>(
    `
      SELECT id FROM profiles 
      WHERE id = $1
      LIMIT 1
    `,
    [profileId],
  );

  return rows.length > 0;
};
