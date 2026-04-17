import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import Postgrator from "postgrator";
import type { EnvDbConfig } from "../../plugins/external/env.js";

export async function doMigration(
  envDbConfig: EnvDbConfig,
  version = "max",
): Promise<void> {
  const client = new pg.Client({
    host: envDbConfig.POSTGRES_HOST,
    port: envDbConfig.POSTGRES_PORT,
    database: envDbConfig.POSTGRES_DB_NAME,
    user: envDbConfig.POSTGRES_USER,
    password: envDbConfig.POSTGRES_PASSWORD,
  });

  try {
    await client.connect();

    const migrationDir = path.join(import.meta.dirname, "../sql");

    if (!fs.existsSync(migrationDir)) {
      throw new Error(
        `Migration directory "${migrationDir}" does not exist. Skipping migrations.`,
      );
    }

    const postgrator = new Postgrator({
      migrationPattern: path.join(migrationDir, "*"),
      driver: "pg",
      database: envDbConfig.POSTGRES_DB_NAME,
      execQuery: (query) => {
        return client.query(query);
      },
      validateChecksums: false,
    });

    const migrated = await postgrator.migrate(version);
    console.log("List of executed migrations: ");
    for (const migration of migrated) {
      console.log(migration.name);
    }
  } catch (err) {
    console.error(err);
    throw err;
  } finally {
    await client.end();
  }
}
