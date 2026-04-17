import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { Client, Pool } from "pg";
import { createDatabase } from "../migrations/scripts/create-database.js";
import { dropDatabase } from "../migrations/scripts/drop-database.js";
import { doMigration } from "../migrations/scripts/migrate.js";

export const DATABASE_TEST_URL_KEY = "DATABASE_TEST_URL";

export function getConfigFromContainer(started: StartedPostgreSqlContainer) {
  return {
    POSTGRES_DB_NAME: started.getDatabase(),
    POSTGRES_HOST: started.getHost(),
    POSTGRES_PASSWORD: started.getPassword(),
    POSTGRES_PORT: started.getPort(),
    POSTGRES_USER: started.getUsername(),
  };
}

export async function startPostgresContainer() {
  return new PostgreSqlContainer("postgres:16-alpine").start();
}

export async function migrateContainer(
  toUseContainer: StartedPostgreSqlContainer,
) {
  const startConfig = getConfigFromContainer(toUseContainer);
  await createDatabase(startConfig);
  await doMigration(startConfig);
}

export async function dropContainer(
  toUseContainer: StartedPostgreSqlContainer,
  stopContainer = true,
) {
  const startConfig = getConfigFromContainer(toUseContainer);
  await dropDatabase(startConfig);

  if (stopContainer) {
    await toUseContainer.stop();
  }
}

export async function getClientFromConnectionString(
  connectionString?: string,
): Promise<Client> {
  const pgClient = new Client({
    connectionString,
  });
  await pgClient.connect();
  return pgClient;
}

export function getPoolFromConnectionString(connectionString?: string): Pool {
  const pgPool = new Pool({
    connectionString,
  });
  return pgPool;
}
