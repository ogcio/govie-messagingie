import env from "@fastify/env";
import fp from "fastify-plugin";

interface EnvDbConfig {
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;
  POSTGRES_HOST: string;
  POSTGRES_PORT: number;
  POSTGRES_DATABASE: string;
  POSTGRES_SSL?: boolean;
}

interface FeatureFlagsConfig {
  FEATURE_FLAGS_URL?: string;
  FEATURE_FLAGS_TOKEN?: string;
}

export interface LogtoManagementConfig {
  LOGTO_MANAGEMENT_API_ENDPOINT: string;
  LOGTO_MANAGEMENT_API_CLIENT_ID: string;
  LOGTO_MANAGEMENT_API_RESOURCE_URL: string;
  LOGTO_MANAGEMENT_API_CLIENT_SECRET: string;
  LOGTO_OIDC_ENDPOINT: string;
}

export interface OTPApplicationsConfig {
  OTP_APPLICATION_IDS?: string;
}

export interface WorkerConfig {
  WORKER_INTERVAL_SECONDS: number;
}

export interface DPProxyConfig {
  DP_PROXY_API_BASE_URL?: string;
  DP_PROXY_WEBHOOK_ACCESS_TOKEN?: string;
}

export interface AuditCollectorConfig {
  AUDIT_COLLECTOR_URL: string;
}

export interface SchedulerConfig {
  SCHEDULER_BACKEND_URL: string;
  LOGTO_M2M_SCHEDULER_APP_ID: string;
  LOGTO_M2M_SCHEDULER_APP_SECRET: string;
}

export interface LifecycleWorkerConfig {
  UPLOAD_BACKEND_URL: string;
  MESSAGING_BACKEND_URL: string;
  LOGTO_M2M_LIFECYCLE_APP_ID: string;
  LOGTO_M2M_LIFECYCLE_APP_SECRET: string;
}

export interface AwsConfig {
  AWS_ACCESS_KEY_ID?: string | undefined;
  AWS_SECRET_ACCESS_KEY?: string | undefined;
  AWS_SECRETS_MANAGER_ENDPOINT?: string | undefined;
  AWS_SECRETS_MANAGER_REGION?: string | undefined;
  PII_HASHER_SECRET_NAME?: string | undefined;
}

interface EnvConfig
  extends LogtoManagementConfig,
    EnvDbConfig,
    FeatureFlagsConfig,
    OTPApplicationsConfig,
    WorkerConfig,
    DPProxyConfig,
    AuditCollectorConfig,
    SchedulerConfig,
    LifecycleWorkerConfig,
    AwsConfig {
  HOST_URL: string;
  PORT: number;
  FASTIFY_CLOSE_GRACE_DELAY: number;
  LOG_LEVEL: string;
  LOGTO_JWK_ENDPOINT: string;
  LOGTO_WEBHOOK_SIGNING_KEY: string;
  ANALYTICS_URL: string | undefined;
  ANALYTICS_WEBSITE_ID: string | undefined;
  ANALYTICS_MATOMO_TOKEN: string | undefined;
  ANALYTICS_DRY_RUN: boolean;
  LOGTO_M2M_ANALYTICS_APP_SECRET: string;
  LOGTO_M2M_ANALYTICS_ORGANIZATION_ID: string;
  LOGTO_M2M_ANALYTICS_APP_ID: string;
  LOGTO_M2M_ANALYTICS_SCOPES: string;
  PROFILES_IMPORTER_BATCH_SIZE: number;
  PROFILES_IMPORTER_BATCH_DELAY_SECONDS: number;
}

export type M2MSdksConfig = AuditCollectorConfig &
  SchedulerConfig &
  LifecycleWorkerConfig &
  Pick<LogtoManagementConfig, "LOGTO_OIDC_ENDPOINT">;

declare module "fastify" {
  export interface FastifyInstance {
    config: EnvConfig;
  }
}

export const envConfigSchema = {
  type: "object",
  required: [
    "HOST_URL",
    "PORT",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "POSTGRES_HOST",
    "POSTGRES_PORT",
    "POSTGRES_DATABASE",
    "LOGTO_JWK_ENDPOINT",
    "LOGTO_OIDC_ENDPOINT",
    "LOGTO_WEBHOOK_SIGNING_KEY",
    "LOGTO_MANAGEMENT_API_CLIENT_ID",
    "LOGTO_MANAGEMENT_API_CLIENT_SECRET",
    "LOGTO_MANAGEMENT_API_ENDPOINT",
    "LOGTO_MANAGEMENT_API_RESOURCE_URL",
    "ANALYTICS_URL",
    "ANALYTICS_WEBSITE_ID",
    "SCHEDULER_BACKEND_URL",
    "LOGTO_M2M_SCHEDULER_APP_ID",
    "LOGTO_M2M_SCHEDULER_APP_SECRET",
    "LOGTO_M2M_ANALYTICS_APP_SECRET",
    "LOGTO_M2M_ANALYTICS_APP_ID",
    "LOGTO_M2M_ANALYTICS_SCOPES",
    "LOGTO_M2M_ANALYTICS_ORGANIZATION_ID",
    "PROFILES_IMPORTER_BATCH_SIZE",
    "PROFILES_IMPORTER_BATCH_DELAY_SECONDS",
    "AUDIT_COLLECTOR_URL",
    "UPLOAD_BACKEND_URL",
    "MESSAGING_BACKEND_URL",
    "LOGTO_M2M_LIFECYCLE_APP_ID",
    "LOGTO_M2M_LIFECYCLE_APP_SECRET",
  ],
  properties: {
    HOST_URL: { type: "string" },
    PORT: { type: "number" },
    FASTIFY_CLOSE_GRACE_DELAY: { type: "number", default: 500 },
    LOG_LEVEL: { type: "string", default: "debug" },
    POSTGRES_USER: { type: "string" },
    POSTGRES_PASSWORD: { type: "string" },
    POSTGRES_HOST: { type: "string" },
    POSTGRES_PORT: { type: "number" },
    POSTGRES_DATABASE: { type: "string" },
    LOGTO_JWK_ENDPOINT: { type: "string" },
    LOGTO_OIDC_ENDPOINT: { type: "string" },
    LOGTO_WEBHOOK_SIGNING_KEY: { type: "string" },
    LOGTO_MANAGEMENT_API_CLIENT_ID: { type: "string" },
    LOGTO_MANAGEMENT_API_CLIENT_SECRET: { type: "string" },
    LOGTO_MANAGEMENT_API_ENDPOINT: { type: "string" },
    LOGTO_MANAGEMENT_API_RESOURCE_URL: { type: "string" },
    ANALYTICS_URL: { type: "string" },
    ANALYTICS_WEBSITE_ID: { type: "string" },
    ANALYTICS_MATOMO_TOKEN: { type: "string" },
    ANALYTICS_DRY_RUN: { type: "boolean", default: true },
    SCHEDULER_BACKEND_URL: { type: "string" },
    LOGTO_M2M_SCHEDULER_APP_ID: { type: "string" },
    LOGTO_M2M_SCHEDULER_APP_SECRET: { type: "string" },
    LOGTO_M2M_ANALYTICS_APP_SECRET: { type: "string" },
    LOGTO_M2M_ANALYTICS_APP_ID: { type: "string" },
    LOGTO_M2M_ANALYTICS_SCOPES: { type: "string" },
    LOGTO_M2M_ANALYTICS_ORGANIZATION_ID: { type: "string" },
    PROFILES_IMPORTER_BATCH_SIZE: { type: "number", default: 100 },
    PROFILES_IMPORTER_BATCH_DELAY_SECONDS: { type: "number", default: 30 },
    FEATURE_FLAGS_URL: { type: "string" },
    FEATURE_FLAGS_TOKEN: { type: "string" },
    OTP_APPLICATION_IDS: { type: "string" },
    WORKER_INTERVAL_SECONDS: { type: "number", default: 60 },
    DP_PROXY_API_BASE_URL: { type: "string" },
    DP_PROXY_WEBHOOK_ACCESS_TOKEN: { type: "string" },
    AUDIT_COLLECTOR_URL: { type: "string" },
    UPLOAD_BACKEND_URL: { type: "string" },
    MESSAGING_BACKEND_URL: { type: "string" },
    LOGTO_M2M_LIFECYCLE_APP_ID: { type: "string" },
    LOGTO_M2M_LIFECYCLE_APP_SECRET: { type: "string" },
    AWS_ACCESS_KEY_ID: { type: "string" },
    AWS_SECRET_ACCESS_KEY: { type: "string" },
    AWS_SECRETS_MANAGER_ENDPOINT: { type: "string" },
    AWS_SECRETS_MANAGER_REGION: { type: "string" },
    PII_HASHER_SECRET_NAME: { type: "string" },
    POSTGRES_SSL: { type: "boolean", default: false },
  },
};

export const autoConfig = {
  schema: envConfigSchema,
  dotenv: { quiet: true },
};

export default fp(env, { name: "env" });
export type { EnvConfig, EnvDbConfig };
