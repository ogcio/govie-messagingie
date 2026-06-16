import { constants as fsConstants } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import type { CliCommand, LoadedConfig } from "../domain/types.js";
import { getRequiredEnvValue, loadEnvContract } from "./env-contract.js";
import { isIso8601Timestamp } from "./resolve-send-at.js";

type LoadConfigInput = {
  env: NodeJS.ProcessEnv;
  cli: CliCommand;
  scriptRoot: string;
};

export async function loadConfig({
  env,
  cli,
  scriptRoot,
}: LoadConfigInput): Promise<LoadedConfig> {
  const problems: string[] = [];

  const requiredKeys = await loadEnvContract(scriptRoot);
  const values = new Map<string, string>();

  for (const key of requiredKeys) {
    const value = getRequiredEnvValue(env, key, problems);
    if (value != null) {
      values.set(key, value);
    }
  }

  const postgresPort = parseIntegerValue(
    values.get("POSTGRES_PORT"),
    "POSTGRES_PORT",
    problems,
  );
  const sendBatchSize = parseIntegerValue(
    values.get("SEND_BATCH_SIZE"),
    "SEND_BATCH_SIZE",
    problems,
  );
  const sendBatchDelayMs = parseIntegerValue(
    values.get("SEND_BATCH_DELAY_MS"),
    "SEND_BATCH_DELAY_MS",
    problems,
  );
  const eventSyncDelaySeconds = parseIntegerValue(
    values.get("EVENT_SYNC_DELAY_SECONDS"),
    "EVENT_SYNC_DELAY_SECONDS",
    problems,
  );

  const logtoOidcEndpoint = normalizeUrl(
    values.get("LOGTO_OIDC_ENDPOINT"),
    "LOGTO_OIDC_ENDPOINT",
    problems,
    { trailingSlash: true },
  );
  const profileBackendUrl = normalizeUrl(
    values.get("PROFILE_BACKEND_URL"),
    "PROFILE_BACKEND_URL",
    problems,
  );
  const messagingBackendUrl = normalizeUrl(
    values.get("MESSAGING_BACKEND_URL"),
    "MESSAGING_BACKEND_URL",
    problems,
  );

  const recipientsCsvPath = values.get("RECIPIENTS_CSV_PATH");
  const htmlTemplatePath = values.get("HTML_TEMPLATE_PATH");
  const txtTemplatePath = values.get("TXT_TEMPLATE_PATH");
  const shouldValidateFingerprintInputs = !isStatusRunIdCommand(cli);

  if (shouldValidateFingerprintInputs) {
    validateCliCommand(cli, problems);
  }

  let hasReadableRecipientsCsvPath = false;

  if (shouldValidateFingerprintInputs) {
    [hasReadableRecipientsCsvPath] = await Promise.all([
      validateReadableFile(recipientsCsvPath, "RECIPIENTS_CSV_PATH", problems),
      validateReadableFile(htmlTemplatePath, "HTML_TEMPLATE_PATH", problems),
      validateReadableFile(txtTemplatePath, "TXT_TEMPLATE_PATH", problems),
    ]);
  }

  if (
    shouldValidateFingerprintInputs &&
    hasReadableRecipientsCsvPath &&
    recipientsCsvPath != null
  ) {
    await validateRecipientsCsv(recipientsCsvPath, problems);
  }

  if (problems.length > 0) {
    throw new Error(
      `Invalid send-message-batches config: ${problems.join("; ")}`,
    );
  }

  return {
    command: cloneCommand(cli),
    database: {
      user: getMapValue(values, "POSTGRES_USER"),
      password: getMapValue(values, "POSTGRES_PASSWORD"),
      host: getMapValue(values, "POSTGRES_HOST"),
      port: getNumberValue(postgresPort, "POSTGRES_PORT"),
      databaseName: getMapValue(values, "POSTGRES_DB_NAME"),
    },
    logtoOidcEndpoint: getStringValue(logtoOidcEndpoint, "LOGTO_OIDC_ENDPOINT"),
    publicServantClientId: getMapValue(values, "PUBLIC_SERVANT_CLIENT_ID"),
    publicServantClientSecret: getMapValue(
      values,
      "PUBLIC_SERVANT_CLIENT_SECRET",
    ),
    publicServantOrganizationId: getMapValue(
      values,
      "PUBLIC_SERVANT_ORGANIZATION_ID",
    ),
    publicServantScopes: getMapValue(values, "PUBLIC_SERVANT_SCOPES"),
    profileBackendUrl: getStringValue(profileBackendUrl, "PROFILE_BACKEND_URL"),
    messagingBackendUrl: getStringValue(
      messagingBackendUrl,
      "MESSAGING_BACKEND_URL",
    ),
    recipientsCsvPath: getStringValue(recipientsCsvPath, "RECIPIENTS_CSV_PATH"),
    htmlTemplatePath: getStringValue(htmlTemplatePath, "HTML_TEMPLATE_PATH"),
    txtTemplatePath: getStringValue(txtTemplatePath, "TXT_TEMPLATE_PATH"),
    messageSubject: getMapValue(values, "MESSAGE_SUBJECT"),
    sendBatchSize: getNumberValue(sendBatchSize, "SEND_BATCH_SIZE"),
    sendBatchDelayMs: getNumberValue(sendBatchDelayMs, "SEND_BATCH_DELAY_MS"),
    eventSyncDelaySeconds: getNumberValue(
      eventSyncDelaySeconds,
      "EVENT_SYNC_DELAY_SECONDS",
    ),
    richTextEncodeBase64:
      env.RICH_TEXT_ENCODE_BASE64?.trim().toLowerCase() === "true",
  };
}

function getMapValue(values: Map<string, string>, key: string): string {
  const value = values.get(key);

  if (value == null) {
    throw new Error(`Missing required configuration value: ${key}`);
  }

  return value;
}

function getStringValue(value: string | undefined, key: string): string {
  if (value == null) {
    throw new Error(`Missing required configuration value: ${key}`);
  }

  return value;
}

function getNumberValue(value: number | undefined, key: string): number {
  if (value == null) {
    throw new Error(`Missing required configuration value: ${key}`);
  }

  return value;
}

function parseIntegerValue(
  value: string | undefined,
  key: string,
  problems: string[],
): number | undefined {
  if (value == null) {
    return undefined;
  }

  if (!/^\d+$/u.test(value)) {
    problems.push(`${key} must be an integer`);
    return undefined;
  }

  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue)) {
    problems.push(`${key} must be an integer`);
    return undefined;
  }

  return parsedValue;
}

function normalizeUrl(
  value: string | undefined,
  key: string,
  problems: string[],
  options?: { trailingSlash?: boolean },
): string | undefined {
  if (value == null) {
    return undefined;
  }

  try {
    const url = new URL(value);

    if (options?.trailingSlash === true && !url.pathname.endsWith("/")) {
      url.pathname = `${url.pathname}/`;
    }

    return url.toString();
  } catch {
    problems.push(`${key} must be a valid URL`);
    return undefined;
  }
}

async function validateReadableFile(
  filePath: string | undefined,
  key: string,
  problems: string[],
): Promise<boolean> {
  if (filePath == null) {
    return false;
  }

  try {
    await access(filePath, fsConstants.R_OK);

    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) {
      problems.push(`${key} must point to a readable file`);
      return false;
    }

    return true;
  } catch {
    problems.push(`${key} must point to a readable file`);
    return false;
  }
}

function validateCliCommand(command: CliCommand, problems: string[]): void {
  if (command.sendAt != null && !isIso8601Timestamp(command.sendAt)) {
    problems.push("--send-at must be a valid ISO-8601 timestamp");
  }
}

function isStatusRunIdCommand(command: CliCommand): boolean {
  return command.kind === "status" && command.runId != null;
}

async function validateRecipientsCsv(
  recipientsCsvPath: string,
  problems: string[],
): Promise<void> {
  try {
    const csvContents = await readFile(recipientsCsvPath, "utf8");
    const [headerLine = ""] = csvContents.split(/\r?\n/u);

    if (headerLine.trim() !== "email") {
      problems.push(
        "RECIPIENTS_CSV_PATH must point to a CSV whose first header is exactly 'email'",
      );
    }
  } catch {
    problems.push("RECIPIENTS_CSV_PATH must point to a readable file");
  }
}

function cloneCommand(command: CliCommand): CliCommand {
  if (command.kind === "status") {
    return {
      kind: "status",
      runId: command.runId,
      sendAt: command.sendAt,
    };
  }

  return {
    kind: "run",
    forceNew: command.forceNew,
    sendAt: command.sendAt,
    eventSyncDelaySeconds: command.eventSyncDelaySeconds,
  };
}
