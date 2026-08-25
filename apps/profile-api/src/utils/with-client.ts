import type { Pool, PoolClient } from "pg";

export const withClient = async <T>(
  pool: Pool,
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> => {
  const client = await pool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
};
