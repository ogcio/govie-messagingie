import { readFileSync } from "node:fs";
import { Pool, type PoolConfig } from "pg";
import type { EnvDbConfig } from "../../config.js";

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

  for (const key of Object.keys(envs)) {
    if (envs[key as keyof EnvDbConfig] === undefined) {
      throw new Error(`Cannot run migration, ${key} is missing`);
    }
  }

  return envs as EnvDbConfig;
}

export function getSslConfig(ssl: boolean): PoolConfig["ssl"] {
  if (!ssl) {
    return false;
  }

  const certificatePath = new URL(
    "../../certificates/global-bundle.pem",
    import.meta.url,
  ).pathname;

  const ca = readFileSync(certificatePath);

  return {
    rejectUnauthorized: false,
    ca,
  };
}

export function getPgConnection(
  envDbConfig: EnvDbConfig | string,
  additionalConfig?: Partial<PoolConfig>,
): Pool {
  if (typeof envDbConfig === "string") {
    return new Pool({ connectionString: envDbConfig, ...additionalConfig });
  }

  return new Pool({
    host: envDbConfig.POSTGRES_HOST,
    port: envDbConfig.POSTGRES_PORT,
    database: envDbConfig.POSTGRES_DB_NAME,
    user: envDbConfig.POSTGRES_USER,
    password: envDbConfig.POSTGRES_PASSWORD,
    ssl: getSslConfig(envDbConfig.POSTGRES_SSL),
    ...additionalConfig,
  });
}

export const POSTGRES_DB_NAME = "postgres";
