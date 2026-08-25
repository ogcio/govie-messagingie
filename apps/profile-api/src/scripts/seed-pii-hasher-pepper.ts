import {
  CreateSecretCommand,
  GetSecretValueCommand,
  SecretsManagerClient,
  type SecretsManagerClientConfig,
} from "@aws-sdk/client-secrets-manager";
import { pino } from "pino";
import type { AwsConfig } from "~/plugins/external/env.js";

const logger = pino();

function validateEnvVariables():
  | { areVarsValid: false; message: string }
  | {
      areVarsValid: true;
      vars: AwsConfig &
        Required<
          Omit<AwsConfig, "AWS_ACCESS_KEY_ID" | "AWS_SECRET_ACCESS_KEY">
        >;
    } {
  const requiredVars = [
    "AWS_SECRETS_MANAGER_ENDPOINT",
    "AWS_SECRETS_MANAGER_REGION",
    "PII_HASHER_SECRET_NAME",
  ];

  const missingVars = requiredVars.filter(
    (varName) => !process.env[varName] || process.env[varName].trim() === "",
  );

  if (missingVars.length > 0) {
    return {
      areVarsValid: false,
      message: `Missing required environment variables: ${missingVars.join(", ")}`,
    };
  }

  return {
    areVarsValid: true,
    vars: {
      AWS_SECRETS_MANAGER_ENDPOINT: (
        process.env.AWS_SECRETS_MANAGER_ENDPOINT as string
      ).trim(),
      AWS_SECRETS_MANAGER_REGION: (
        process.env.AWS_SECRETS_MANAGER_REGION as string
      ).trim(),
      PII_HASHER_SECRET_NAME: (
        process.env.PII_HASHER_SECRET_NAME as string
      ).trim(),
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID?.trim() ?? undefined,
      AWS_SECRET_ACCESS_KEY:
        process.env.AWS_SECRET_ACCESS_KEY?.trim() ?? undefined,
    },
  };
}

function parseSecretValue(): string {
  const argIndex = process.argv.indexOf("--secret-value");
  if (argIndex === -1 || argIndex + 1 >= process.argv.length) {
    logger.error("Missing required argument: --secret-value <value>");
    process.exit(1);
  }

  const value = process.argv[argIndex + 1];
  if (value.length < 12) {
    logger.error("--secret-value must be at least 12 characters long");
    process.exit(1);
  }

  return value;
}

async function main(secretValue: string) {
  const validationResult = validateEnvVariables();
  if (!validationResult.areVarsValid) {
    logger.error(validationResult.message);
    process.exit(1);
  }

  const config: SecretsManagerClientConfig = {
    region: validationResult.vars.AWS_SECRETS_MANAGER_REGION,
    endpoint: validationResult.vars.AWS_SECRETS_MANAGER_ENDPOINT,
  };

  if (
    validationResult.vars.AWS_ACCESS_KEY_ID &&
    validationResult.vars.AWS_SECRET_ACCESS_KEY
  ) {
    config.credentials = {
      accessKeyId: validationResult.vars.AWS_ACCESS_KEY_ID,
      secretAccessKey: validationResult.vars.AWS_SECRET_ACCESS_KEY,
    };
  }

  const client = new SecretsManagerClient(config);

  try {
    await client.send(
      new GetSecretValueCommand({
        SecretId: validationResult.vars.PII_HASHER_SECRET_NAME,
      }),
    );
    logger.info(
      `Secret ${validationResult.vars.PII_HASHER_SECRET_NAME} already exists in Secrets Manager`,
    );
  } catch (error) {
    if ((error as Error).name === "ResourceNotFoundException") {
      const secretPayload = JSON.stringify({
        activeVersion: "2",
        key: Buffer.from(secretValue).toString("base64"),
      });
      await client.send(
        new CreateSecretCommand({
          Name: validationResult.vars.PII_HASHER_SECRET_NAME,
          SecretString: secretPayload,
        }),
      );
      logger.info(
        `Test secret ${validationResult.vars.PII_HASHER_SECRET_NAME} created in Secrets Manager`,
      );
    } else {
      logger.error(
        { error },
        `Error checking/creating test secret ${validationResult.vars.PII_HASHER_SECRET_NAME} in Secrets Manager`,
      );
      throw error;
    }
  }
}

logger.info("Starting seed-pii-hasher-pepper script");
const secretValue = parseSecretValue();
try {
  await main(secretValue);
  logger.info("seed-pii-hasher-pepper script completed successfully");
} catch (error) {
  logger.error({ error }, "Error running seed-pii-hasher-pepper script");
  process.exit(1);
}
