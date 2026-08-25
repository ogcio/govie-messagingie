import pg, { type Client } from "pg";
import type { EnvDbConfig } from "~/plugins/external/env.js";
import { POSTGRES_DB_NAME } from "./shared.js";

export async function dropDatabase(envDbConfig: EnvDbConfig): Promise<void> {
  if (envDbConfig.POSTGRES_DATABASE === POSTGRES_DB_NAME) {
    throw new Error(`You can't drop ${POSTGRES_DB_NAME}`);
  }
  const client = new pg.Client({
    host: envDbConfig.POSTGRES_HOST,
    port: envDbConfig.POSTGRES_PORT,
    user: envDbConfig.POSTGRES_USER,
    password: envDbConfig.POSTGRES_PASSWORD,
    database: POSTGRES_DB_NAME, //connecting here because otherwise we can't drop the needed one
  });

  try {
    await client.connect();
    await runQuery(client, envDbConfig.POSTGRES_DATABASE);
  } catch (err) {
    console.error("Dropping db", err);
  } finally {
    await client.end();
  }
}

async function runQuery(client: Client, dbName: string) {
  await client.query(`DROP DATABASE ${dbName}`);
  console.log(`Database ${dbName} dropped.`);
}
