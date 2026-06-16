import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const SEND_MESSAGE_BATCHES_ENV_FILENAME = ".env";
export const SEND_MESSAGE_BATCHES_ENV_SAMPLE_FILENAME = ".env.sample";

export const REQUIRED_ENV_KEYS = [
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "POSTGRES_HOST",
  "POSTGRES_PORT",
  "POSTGRES_DB_NAME",
  "LOGTO_OIDC_ENDPOINT",
  "PUBLIC_SERVANT_CLIENT_ID",
  "PUBLIC_SERVANT_CLIENT_SECRET",
  "PUBLIC_SERVANT_ORGANIZATION_ID",
  "PUBLIC_SERVANT_SCOPES",
  "PROFILE_BACKEND_URL",
  "MESSAGING_BACKEND_URL",
  "RECIPIENTS_CSV_PATH",
  "HTML_TEMPLATE_PATH",
  "TXT_TEMPLATE_PATH",
  "MESSAGE_SUBJECT",
  "SEND_BATCH_SIZE",
  "SEND_BATCH_DELAY_MS",
  "EVENT_SYNC_DELAY_SECONDS",
] as const;

export type RequiredEnvKey = (typeof REQUIRED_ENV_KEYS)[number];

export const SEND_MESSAGE_BATCHES_ENV_SAMPLE = `${REQUIRED_ENV_KEYS.map((key) => `${key}=`).join("\n")}\n`;

export async function loadEnvContract(
  scriptRoot: string,
): Promise<readonly RequiredEnvKey[]> {
  const samplePath = join(scriptRoot, SEND_MESSAGE_BATCHES_ENV_SAMPLE_FILENAME);
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
        `missing ${requiredKey} in ${SEND_MESSAGE_BATCHES_ENV_SAMPLE_FILENAME}`,
      );
    }
  }

  for (const parsedKey of parsedKeys) {
    if (!REQUIRED_ENV_KEYS.includes(parsedKey as RequiredEnvKey)) {
      problems.push(
        `unexpected ${parsedKey} in ${SEND_MESSAGE_BATCHES_ENV_SAMPLE_FILENAME}`,
      );
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Invalid send-message-batches env contract: ${problems.join("; ")}`,
    );
  }

  return REQUIRED_ENV_KEYS;
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

  return value;
}
