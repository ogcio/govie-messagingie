import { join } from "node:path";
import type { CliCommand } from "../cli.js";
import {
  getOptionalEnvValue,
  getRequiredEnvValue,
  VERIFY_SMTP_ENV_FILENAME,
  validateEnvSample,
} from "./env-contract.js";

export type SmtpConfig = {
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly password: string;
  readonly secure: boolean;
  readonly fromAddress: string | undefined;
};

export type ConfigSummary = {
  readonly source: "cli-flags" | "env-file";
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly secure: boolean;
  readonly fromAddress: string | undefined;
};

export type LoadedConfig = {
  readonly smtp: SmtpConfig;
  readonly summary: ConfigSummary;
};

export async function loadConfig(
  cli: CliCommand,
  scriptRoot: string,
): Promise<LoadedConfig> {
  if (cli.kind === "env-config") {
    return loadFromEnvFile(scriptRoot);
  }

  return {
    smtp: {
      host: cli.host,
      port: cli.port,
      username: cli.username,
      password: cli.password,
      secure: cli.secure,
      fromAddress: cli.fromAddress,
    },
    summary: {
      source: "cli-flags",
      host: cli.host,
      port: cli.port,
      username: cli.username,
      secure: cli.secure,
      fromAddress: cli.fromAddress,
    },
  };
}

async function loadFromEnvFile(scriptRoot: string): Promise<LoadedConfig> {
  await validateEnvSample(scriptRoot);

  const envPath = join(scriptRoot, VERIFY_SMTP_ENV_FILENAME);

  // Node >=24 built-in — no dotenv dependency needed
  process.loadEnvFile(envPath);

  const problems: string[] = [];

  const host = getRequiredEnvValue(
    process.env,
    "EMAIL_PROVIDER_SMTP_HOST",
    problems,
  );
  const portRaw = getRequiredEnvValue(
    process.env,
    "EMAIL_PROVIDER_SMTP_PORT",
    problems,
  );
  const username = getRequiredEnvValue(
    process.env,
    "EMAIL_PROVIDER_SMTP_USERNAME",
    problems,
  );
  const password = getRequiredEnvValue(
    process.env,
    "EMAIL_PROVIDER_SMTP_PASSWORD",
    problems,
  );
  const sslRaw = getRequiredEnvValue(
    process.env,
    "EMAIL_PROVIDER_SMTP_USE_SSL",
    problems,
  );

  const port = parsePort(portRaw, problems);
  const secure = parseSecure(sslRaw, problems);

  const fromAddress = getOptionalEnvValue(
    process.env,
    "EMAIL_PROVIDER_SMTP_FROM_ADDRESS",
  );

  if (problems.length > 0) {
    throw new Error(`Invalid verify-smtp env config: ${problems.join("; ")}`);
  }

  return {
    smtp: {
      host: host as string,
      port: port as number,
      username: username as string,
      password: password as string,
      secure: secure as boolean,
      fromAddress,
    },
    summary: {
      source: "env-file",
      host: host as string,
      port: port as number,
      username: username as string,
      secure: secure as boolean,
      fromAddress,
    },
  };
}

function parsePort(
  raw: string | undefined,
  problems: string[],
): number | undefined {
  if (raw == null) {
    return undefined;
  }

  if (!/^\d+$/u.test(raw)) {
    problems.push("EMAIL_PROVIDER_SMTP_PORT must be an integer");
    return undefined;
  }

  const value = Number.parseInt(raw, 10);

  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    problems.push("EMAIL_PROVIDER_SMTP_PORT must be between 1 and 65535");
    return undefined;
  }

  return value;
}

function parseSecure(
  raw: string | undefined,
  problems: string[],
): boolean | undefined {
  if (raw == null) {
    return undefined;
  }

  const normalized = raw.trim().toLowerCase();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  problems.push(
    `EMAIL_PROVIDER_SMTP_USE_SSL must be true or false, received: ${raw}`,
  );
  return undefined;
}
