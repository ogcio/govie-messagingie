import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const VERIFY_SMTP_ENV_FILENAME = ".env";
export const VERIFY_SMTP_ENV_SAMPLE_FILENAME = ".env.sample";

export const REQUIRED_ENV_KEYS = [
  "EMAIL_PROVIDER_SMTP_HOST",
  "EMAIL_PROVIDER_SMTP_PORT",
  "EMAIL_PROVIDER_SMTP_USERNAME",
  "EMAIL_PROVIDER_SMTP_PASSWORD",
  "EMAIL_PROVIDER_SMTP_USE_SSL",
] as const;

export const OPTIONAL_ENV_KEYS = ["EMAIL_PROVIDER_SMTP_FROM_ADDRESS"] as const;

export type RequiredEnvKey = (typeof REQUIRED_ENV_KEYS)[number];
export type OptionalEnvKey = (typeof OPTIONAL_ENV_KEYS)[number];

export async function validateEnvSample(scriptRoot: string): Promise<void> {
  const samplePath = join(scriptRoot, VERIFY_SMTP_ENV_SAMPLE_FILENAME);
  const sampleContents = await readFile(samplePath, "utf8");

  const parsedKeys = sampleContents
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => {
      const [key] = line.split("=", 1);
      return key?.trim() ?? "";
    })
    .filter((key): key is string => key.length > 0);

  const problems: string[] = [];

  for (const requiredKey of REQUIRED_ENV_KEYS) {
    if (!parsedKeys.includes(requiredKey)) {
      problems.push(
        `missing ${requiredKey} in ${VERIFY_SMTP_ENV_SAMPLE_FILENAME}`,
      );
    }
  }

  for (const parsedKey of parsedKeys) {
    const allKnown = [
      ...(REQUIRED_ENV_KEYS as readonly string[]),
      ...(OPTIONAL_ENV_KEYS as readonly string[]),
    ];
    if (!allKnown.includes(parsedKey)) {
      problems.push(
        `unexpected ${parsedKey} in ${VERIFY_SMTP_ENV_SAMPLE_FILENAME}`,
      );
    }
  }

  if (problems.length > 0) {
    throw new Error(`Invalid verify-smtp env contract: ${problems.join("; ")}`);
  }
}

export function getRequiredEnvValue(
  env: NodeJS.ProcessEnv,
  key: RequiredEnvKey,
  problems: string[],
): string | undefined {
  const value = env[key];

  if (value == null || value.trim().length === 0) {
    problems.push(`${key} is required`);
    return undefined;
  }

  return value.trim();
}

export function getOptionalEnvValue(
  env: NodeJS.ProcessEnv,
  key: OptionalEnvKey,
): string | undefined {
  const value = env[key];
  return value != null && value.trim().length > 0 ? value.trim() : undefined;
}
