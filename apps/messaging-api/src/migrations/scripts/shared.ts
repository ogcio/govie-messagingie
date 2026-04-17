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
  };

  for (const key in Object.keys(envs)) {
    if (!envs) {
      throw new Error(`Cannot run migration, ${key} is missing`);
    }
  }

  return envs as EnvDbConfig;
}

export const POSTGRES_DB_NAME = "postgres";
