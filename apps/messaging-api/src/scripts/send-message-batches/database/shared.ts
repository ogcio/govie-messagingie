import { Pool } from "pg";
import type { DatabaseConfig } from "../domain/types.js";

const ADMIN_DATABASE_NAME = "postgres";

function encodeConnectionPart(value: string): string {
  return encodeURIComponent(value);
}

export function getAdminConnectionString(config: DatabaseConfig): string {
  return `postgresql://${encodeConnectionPart(config.user)}:${encodeConnectionPart(config.password)}@${config.host}:${config.port}/${ADMIN_DATABASE_NAME}`;
}

export function getDatabaseConnectionString(config: DatabaseConfig): string {
  assertSafeDatabaseName(config.databaseName);
  return `postgresql://${encodeConnectionPart(config.user)}:${encodeConnectionPart(config.password)}@${config.host}:${config.port}/${config.databaseName}`;
}

export function createDatabasePool(config: DatabaseConfig): Pool {
  return new Pool({
    connectionString: getDatabaseConnectionString(config),
  });
}

export function assertSafeDatabaseName(databaseName: string): void {
  if (!/^[a-z_][a-z0-9_]*$/u.test(databaseName)) {
    throw new Error(`Unsafe database name: ${databaseName}`);
  }
}
