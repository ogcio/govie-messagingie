import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  SecretsManagerClient,
  type SecretsManagerClientConfig,
} from "@aws-sdk/client-secrets-manager";
import {
  createPiiHasher,
  type PepperService,
} from "@ogcio/pii-utils/pii-hasher";
import { createAwsPepperService } from "@ogcio/pii-utils/pii-hasher/aws";

const DEFAULT_REGION = "eu-west-1";
const CONFIG_PATH = path.join(import.meta.dirname, "pii-hash.config.json");

export type AppConfig = {
  "secret-name"?: string;
  "secret-value"?: string;
};

export type Config = {
  region?: string;
  endpoint?: string;
  applications: Record<string, AppConfig>;
};

export function loadConfig(raw: string): Config {
  const parsed = JSON.parse(raw) as Config;
  if (!parsed.applications || typeof parsed.applications !== "object") {
    throw new Error("Config must have an 'applications' object");
  }
  const entries = Object.entries(parsed.applications);
  if (entries.length === 0) {
    throw new Error("Config 'applications' is empty");
  }
  for (const [appId, app] of entries) {
    const hasName =
      typeof app["secret-name"] === "string" && app["secret-name"].length > 0;
    const hasValue =
      typeof app["secret-value"] === "string" && app["secret-value"].length > 0;
    if (!hasName && !hasValue) {
      throw new Error(
        `Application '${appId}' must have 'secret-name' or 'secret-value'`,
      );
    }
  }
  return parsed;
}

export function buildPepperService(
  app: AppConfig,
  aws: { region: string; endpoint?: string },
): PepperService {
  const secretValue = app["secret-value"];
  if (secretValue) {
    const value = Buffer.from(secretValue, "base64");
    return {
      async fetch() {
        return { value, version: "offline" };
      },
    };
  }
  const clientConfig: SecretsManagerClientConfig = { region: aws.region };
  if (aws.endpoint) {
    clientConfig.endpoint = aws.endpoint;
  }
  return createAwsPepperService({
    secretName: app["secret-name"] as string,
    client: new SecretsManagerClient(clientConfig),
  });
}

export async function hashUserId(
  userId: string,
  applicationId: string,
  pepperService: PepperService,
): Promise<{ hash: string; pepperVersion: string }> {
  const hasher = createPiiHasher({ pepperService, applicationId });
  try {
    return await hasher.hash(userId);
  } finally {
    hasher.dispose();
  }
}

async function main(): Promise<void> {
  const { positionals } = parseArgs({ allowPositionals: true });
  const userId = positionals[0];
  if (!userId) {
    console.error("Usage: pnpm --filter messaging-api pii-hash <userId>");
    process.exitCode = 1;
    return;
  }

  const config = loadConfig(readFileSync(CONFIG_PATH, "utf8"));
  const region = config.region ?? DEFAULT_REGION;

  console.error(`Recreating pseudoUserId for userId=${userId}\n`);
  for (const [applicationId, app] of Object.entries(config.applications)) {
    try {
      const pepperService = buildPepperService(app, {
        region,
        endpoint: config.endpoint,
      });
      const { hash, pepperVersion } = await hashUserId(
        userId,
        applicationId,
        pepperService,
      );
      console.log(`${applicationId}\t${hash}\t(version: ${pepperVersion})`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log(`${applicationId}\tERROR: ${message}`);
    }
  }
}

if (process.argv[1] === import.meta.filename) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
