import { readFileSync } from "node:fs";
import { Pool, type PoolConfig } from "pg";
import type { EnvDbConfig } from "../../plugins/external/env.js";

export function getDbEnvs(): EnvDbConfig {
  const envs: Partial<EnvDbConfig> = {
    POSTGRES_DB_NAME: process.env.POSTGRES_DB_NAME,
    POSTGRES_HOST: process.env.POSTGRES_HOST,
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
    POSTGRES_PORT: process.env.POSTGRES_PORT
      ? Number(process.env.POSTGRES_PORT)
      : undefined,
    POSTGRES_USER: process.env.POSTGRES_USER,
    POSTGRES_SSL: process.env.POSTGRES_SSL?.toLowerCase() === "true",
  };

  for (const key in Object.keys(envs)) {
    if (!key) {
      throw new Error(`Cannot run migration, ${key} is missing`);
    }
  }

  return envs as EnvDbConfig;
}

export function getPgConnection(
  envDbConfig: EnvDbConfig | string,
  additionalConfig?: Partial<PoolConfig>,
): Pool {
  if (typeof envDbConfig === "string") {
    return new Pool({ connectionString: envDbConfig, ...additionalConfig });
  }

  let sslConfig: PoolConfig["ssl"] = false;
  if (typeof envDbConfig !== "string" && envDbConfig.POSTGRES_SSL) {
    console.log("Using SSL for PostgreSQL connection");
    const certificatePath = new URL(
      "../../certificates/global-bundle.pem",
      import.meta.url,
    ).pathname;

    const ca = readFileSync(certificatePath);
    sslConfig = {
      rejectUnauthorized: false,
      ca,
    };
  }

  return new Pool({
    host: envDbConfig.POSTGRES_HOST,
    port: envDbConfig.POSTGRES_PORT,
    database: envDbConfig.POSTGRES_DB_NAME,
    user: envDbConfig.POSTGRES_USER,
    password: envDbConfig.POSTGRES_PASSWORD,
    ssl: sslConfig,
    ...additionalConfig,
  });
}

export const POSTGRES_DB_NAME = "postgres";
