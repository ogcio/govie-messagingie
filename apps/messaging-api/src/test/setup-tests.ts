import { randomBytes, randomUUID } from "node:crypto";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { EnvKeys } from "../plugins/external/env.js";
import {
  DATABASE_TEST_URL_KEY,
  dropContainer,
  migrateContainer,
  startPostgresContainer,
} from "./build-testcontainer-pg.js";

let postgresContainer: StartedPostgreSqlContainer | null = null;

export async function setup() {
  // Start PostgreSQL container
  postgresContainer = await startPostgresContainer();
  await migrateContainer(postgresContainer);
  // This line is used by the pg library to connect to the database when doing tests
  // https://github.com/fastify/fastify-postgres?tab=readme-ov-file#custom-postgres-approach
  process.env[DATABASE_TEST_URL_KEY] = postgresContainer.getConnectionUri();
  setVariablesToRunWithoutEnvFile();
}

export async function teardown() {
  // Stop container after all tests
  if (postgresContainer) {
    await dropContainer(postgresContainer);
  }

  delete process.env[DATABASE_TEST_URL_KEY];
}

const customEnvValues: Record<string, string> = {
  WEBHOOK_URL_BASE: "http://localhost:1000",
  ANALYTICS_WEBSITE_ID: "3e96e2f2-04a3-5576-e168-752846f4515b",
  ANALYTICS_URL: "http://localhost:8075",
  EMAIL_PROVIDER_SMTP_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  HOST_URL: "http://localhost:8989/",
  ANALYTICS_DRY_RUN: "true",
};

async function setVariablesToRunWithoutEnvFile() {
  for (const current of Object.entries(EnvKeys)) {
    const [key, value] = current;
    if (key in customEnvValues) {
      process.env[key] = customEnvValues[key];
      continue;
    }

    if (!value.required) {
      continue;
    }

    if (value.default) {
      process.env[key] = value.default as string;
      continue;
    }

    switch (value.type) {
      case "string":
        process.env[key] = randomUUID().substring(0, 5);
        break;
      case "number":
        process.env[key] = Math.floor(Math.random() * 1000).toString();
        break;
      case "boolean":
        process.env[key] = Math.random() > 0.5 ? "true" : "false";
        break;
      default:
        throw new Error(`Unsupported type ${value.type} for key ${key}`);
    }
  }
}
