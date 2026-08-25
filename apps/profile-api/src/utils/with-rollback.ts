import type { PoolClient } from "pg";

const isInTransaction = async (client: PoolClient): Promise<boolean> => {
  const result = await client.query(
    "SELECT pg_current_xact_id_if_assigned() IS NOT NULL as in_transaction",
  );
  return result.rows[0]?.in_transaction ?? false;
};

export const withRollback = async <T>(
  client: PoolClient,
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> => {
  const alreadyInTransaction = await isInTransaction(client);

  if (alreadyInTransaction) {
    // If already in a transaction, use a savepoint for rollback capability
    const savepointName = `savepoint_${Math.random().toString(36).substring(2, 15)}`;
    try {
      await client.query(`SAVEPOINT ${savepointName}`);
      const result = await callback(client);
      await client.query(`RELEASE SAVEPOINT ${savepointName}`);
      return result;
    } catch (err) {
      await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
      await client.query(`RELEASE SAVEPOINT ${savepointName}`);
      throw err;
    }
  }

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
};
