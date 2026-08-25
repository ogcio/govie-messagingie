import fs from "node:fs";
import path from "node:path";
import type { Pool, PoolClient } from "pg";
import Postgrator from "postgrator";
import type { EnvDbConfig } from "~/plugins/external/env.js";

export async function doMigration(
  envDbConfig: EnvDbConfig,
  inputPool: Pool,
  version = "max",
): Promise<void> {
  const client: PoolClient = await inputPool.connect();
  try {
    const migrationDir = path.join(import.meta.dirname, "../sql");

    if (!fs.existsSync(migrationDir)) {
      throw new Error(
        `Migration directory "${migrationDir}" does not exist. Skipping migrations.`,
      );
    }

    const postgrator = new Postgrator({
      migrationPattern: path.join(migrationDir, "*"),
      driver: "pg",
      database: envDbConfig.POSTGRES_DATABASE,
      execQuery: (query) => client.query(query),
      validateChecksums: false,
    });

    await postgrator.migrate(version);

    console.log("Migration completed!");
  } catch (err) {
    console.error(err);
    throw err;
  } finally {
    client.release();
  }
}
