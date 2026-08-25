import { randomUUID } from "node:crypto";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { envConfigSchema } from "~/plugins/external/env.js";
import { ConsentSubjects } from "~/schemas/consents/shared.js";
import {
  DATABASE_TEST_URL_KEY,
  dropContainer,
  getPoolFromConnectionString,
  migrateContainer,
  startPostgresContainer,
} from "./build-testcontainer-pg.js";
import { insertTestConsentStatement } from "./insert-test-consent-statement.js";

let postgresContainer: StartedPostgreSqlContainer | null = null;

export async function setup() {
  // Start PostgreSQL container
  postgresContainer = await startPostgresContainer();
  await migrateContainer(postgresContainer);

  setVariablesToRunWithoutEnvFile();
  // This line is used by the pg library to connect to the database when doing tests
  // https://github.com/fastify/fastify-postgres?tab=readme-ov-file#custom-postgres-approach
  process.env[DATABASE_TEST_URL_KEY] = postgresContainer.getConnectionUri();

  await seedData();
}

const customEnvValues: Record<string, string | undefined> = {
  ANALYTICS_WEBSITE_ID: "3e96e2f2-04a3-5576-e168-752846f4515b",
  ANALYTICS_URL: "http://localhost:8075",
  HOST_URL: "http://localhost:8989/",
  ANALYTICS_DRY_RUN: "true",
  AWS_SECRETS_MANAGER_ENDPOINT: "",
  AWS_SECRETS_MANAGER_REGION: "",
  PII_HASHER_SECRET_NAME: "",
  AUDIT_COLLECTOR_URL: "http://localhost:8123",
  UPLOAD_BACKEND_URL: "http://localhost:8008",
  MESSAGING_BACKEND_URL: "http://localhost:8002",
  DP_PROXY_API_BASE_URL: "http://localhost:3333",
  FEATURE_FLAGS_URL: "http://localhost:4242",
  SCHEDULER_BACKEND_URL: "http://localhost:8005",
  LOGTO_MANAGEMENT_API_ENDPOINT: "http://localhost:3301/api",
  LOGTO_MANAGEMENT_API_RESOURCE_URL: "https://default.logto.app/api",
  LOGTO_JWK_ENDPOINT: "http://localhost:3301/oidc/jwks",
  LOGTO_OIDC_ENDPOINT: "http://localhost:3301/oidc",
};

async function setVariablesToRunWithoutEnvFile() {
  for (const current of Object.entries(envConfigSchema.properties)) {
    const [key, value] = current;
    if (key in customEnvValues) {
      if (customEnvValues[key] !== undefined) {
        process.env[key] = customEnvValues[key] as string;
      } else {
        delete process.env[key];
      }
      continue;
    }

    if (!envConfigSchema.required.includes(key)) {
      continue;
    }

    if ("default" in value) {
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

export async function teardown() {
  // Stop container after all tests
  if (postgresContainer) {
    await dropContainer(postgresContainer);
  }
}

async function seedData() {
  const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
  try {
    // Not using "createConsentStatement" method to be able to insert
    // an already published statement
    await insertTestConsentStatement(pool, {
      subject: ConsentSubjects.Messaging,
      publishDate: new Date(Date.now() - 1000),
    });
  } finally {
    pool.end();
  }
}
