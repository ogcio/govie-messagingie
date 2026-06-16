import { Client } from "pg";
import type { DatabaseConfig } from "../domain/types.js";
import { assertSafeDatabaseName, getAdminConnectionString } from "./shared.js";

export async function createBatchDatabase(
  databaseConfig: DatabaseConfig,
): Promise<void> {
  assertSafeDatabaseName(databaseConfig.databaseName);

  const client = new Client({
    connectionString: getAdminConnectionString(databaseConfig),
  });

  try {
    await client.connect();

    const result = await client.query<{ datname: string }>(
      "SELECT datname FROM pg_catalog.pg_database WHERE datname = $1",
      [databaseConfig.databaseName],
    );

    if (result.rowCount === 0) {
      await client.query(`CREATE DATABASE "${databaseConfig.databaseName}"`);
    }
  } finally {
    await client.end();
  }
}
