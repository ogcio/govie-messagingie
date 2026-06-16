import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import Postgrator from "postgrator";
import type { DatabaseConfig } from "../domain/types.js";
import {
  assertSafeDatabaseName,
  getDatabaseConnectionString,
} from "./shared.js";

const MIGRATIONS_DIRECTORY = fileURLToPath(new URL("./sql", import.meta.url));
const MIGRATION_PATTERN = path.join(MIGRATIONS_DIRECTORY, "*");

export async function migrateBatchDatabase(
  databaseConfig: DatabaseConfig,
  version?: string,
): Promise<void> {
  assertSafeDatabaseName(databaseConfig.databaseName);

  const client = new Client({
    connectionString: getDatabaseConnectionString(databaseConfig),
  });

  try {
    await client.connect();

    const postgrator = new Postgrator({
      migrationPattern: MIGRATION_PATTERN,
      driver: "pg",
      database: databaseConfig.databaseName,
      schemaTable: "postgrator_migrations",
      execQuery: (query) => {
        return client.query(query);
      },
      validateChecksums: false,
    });

    if (version == null) {
      await postgrator.migrate();
    } else {
      await postgrator.migrate(version);
    }
  } finally {
    await client.end();
  }
}
