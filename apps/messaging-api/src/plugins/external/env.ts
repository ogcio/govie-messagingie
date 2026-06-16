import env from "@fastify/env";

export interface AnalyticsConfig {
  LOGTO_M2M_ANALYTICS_ORGANIZATION_ID: string | undefined;
  ANALYTICS_URL: string | undefined;
  ANALYTICS_MATOMO_TOKEN: string | undefined;
  ANALYTICS_WEBSITE_ID: string | undefined;
  ANALYTICS_DRY_RUN: boolean | undefined;
}

export interface EnvDbConfig {
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;
  POSTGRES_HOST: string;
  POSTGRES_PORT: number;
  POSTGRES_DB_NAME: string;
  POSTGRES_SSL?: boolean;
}

export interface EnvEmailConfig {
  EMAIL_PROVIDER_SMTP_HOST: string;
  EMAIL_PROVIDER_SMTP_PORT: number;
  EMAIL_PROVIDER_SMTP_USERNAME: string;
  EMAIL_PROVIDER_SMTP_PASSWORD: string;
  EMAIL_PROVIDER_SMTP_FROM_ADDRESS: string;
  EMAIL_PROVIDER_SMTP_USE_SSL: boolean;
  EMAIL_PROVIDER_SMTP_TENANT_NAME: string | undefined;
  WEBHOOK_URL_BASE: string;
  EMAIL_PROVIDER_SMTP_ENCRYPTION_KEY: string;
}

export interface EnvSnsConfig {
  SNS_REGION: string | undefined;
  SNS_SENDER_ID: string | undefined;
  SNS_THROTTLE_TIME_MS: number | undefined;
  SNS_ALLOWED_ORGANIZATIONS: string | undefined;
}

interface FeatureFlagsConfig {
  FEATURE_FLAGS_URL?: string;
  FEATURE_FLAGS_TOKEN?: string;
}

interface SupportConfig {
  SUPPORT_ORGANISATION_ID: string;
}

export interface EnvConfig
  extends EnvDbConfig,
    EnvEmailConfig,
    EnvSnsConfig,
    FeatureFlagsConfig,
    SupportConfig,
    AnalyticsConfig {
  HOST_URL: string;
  PROFILE_BACKEND_URL: string;
  LOGTO_JWK_ENDPOINT: string;
  LOGTO_OIDC_ENDPOINT: string;
  LOGTO_API_RESOURCE_INDICATOR: string;
  LOGTO_M2M_PROFILE_APP_SECRET: string;
  LOGTO_M2M_PROFILE_APP_ID: string;
  LOGTO_M2M_ONBOARDING_APP_SECRET: string;
  LOGTO_M2M_ONBOARDING_APP_ID: string;
  LOGTO_M2M_SCHEDULER_APP_SECRET: string;
  LOGTO_M2M_SCHEDULER_APP_ID: string;
  SCHEDULER_BACKEND_URL: string;
  UPLOAD_BACKEND_URL: string;
  LOGTO_M2M_UPLOADER_APP_ID: string;
  LOGTO_M2M_UPLOADER_APP_SECRET: string;
  LOG_LEVEL: string;
  MESSAGING_SECURE_MESSAGE_URL: string;
}

declare module "fastify" {
  export interface FastifyInstance {
    config: EnvConfig;
  }
}

export const EnvKeys: Record<
  string,
  {
    type: "number" | "string" | "boolean";
    default?: number | string | boolean;
    required: boolean;
  }
> = {
  HOST_URL: {
    type: "string",
    required: true,
  },
  POSTGRES_USER: {
    type: "string",
    required: true,
  },
  POSTGRES_PASSWORD: {
    type: "string",
    required: true,
  },
  POSTGRES_HOST: {
    type: "string",
    required: true,
  },
  POSTGRES_PORT: {
    type: "number",
    required: true,
  },
  POSTGRES_DB_NAME: {
    type: "string",
    required: true,
  },
  POSTGRES_SSL: {
    type: "boolean",
    required: false,
    default: false,
  },
  PROFILE_BACKEND_URL: {
    type: "string",
    required: true,
  },
  LOGTO_JWK_ENDPOINT: {
    type: "string",
    required: true,
  },
  LOGTO_OIDC_ENDPOINT: {
    type: "string",
    required: true,
  },
  LOGTO_API_RESOURCE_INDICATOR: {
    type: "string",
    required: true,
  },
  LOGTO_M2M_PROFILE_APP_SECRET: {
    type: "string",
    required: true,
  },
  LOGTO_M2M_PROFILE_APP_ID: {
    type: "string",
    required: true,
  },
  LOGTO_M2M_ONBOARDING_APP_SECRET: {
    type: "string",
    required: true,
  },
  LOGTO_M2M_ONBOARDING_APP_ID: {
    type: "string",
    required: true,
  },
  LOGTO_M2M_SCHEDULER_APP_SECRET: {
    type: "string",
    required: true,
  },
  LOGTO_M2M_SCHEDULER_APP_ID: {
    type: "string",
    required: true,
  },
  SCHEDULER_BACKEND_URL: {
    type: "string",
    required: true,
  },
  UPLOAD_BACKEND_URL: {
    type: "string",
    required: true,
  },
  LOGTO_M2M_UPLOADER_APP_ID: {
    type: "string",
    required: true,
  },
  LOGTO_M2M_UPLOADER_APP_SECRET: {
    type: "string",
    required: true,
  },
  LOG_LEVEL: {
    type: "string",
    default: "debug",
    required: false,
  },
  MESSAGING_SECURE_MESSAGE_URL: {
    type: "string",
    required: true,
  },
  EMAIL_PROVIDER_SMTP_HOST: {
    type: "string",
    required: true,
  },
  EMAIL_PROVIDER_SMTP_PORT: {
    type: "number",
    required: false,
    default: 587,
  },
  EMAIL_PROVIDER_SMTP_USERNAME: {
    type: "string",
    required: true,
  },
  EMAIL_PROVIDER_SMTP_PASSWORD: {
    type: "string",
    required: true,
  },
  EMAIL_PROVIDER_SMTP_FROM_ADDRESS: {
    type: "string",
    required: true,
  },
  EMAIL_PROVIDER_SMTP_USE_SSL: {
    type: "boolean",
    required: false,
    default: true,
  },
  EMAIL_PROVIDER_SMTP_TENANT_NAME: {
    type: "string",
    required: false,
  },
  EMAIL_PROVIDER_SMTP_ENCRYPTION_KEY: {
    type: "string",
    required: true,
  },
  SNS_THROTTLE_TIME_MS: {
    type: "number",
    required: false,
  },
  SNS_REGION: {
    type: "string",
    required: false,
  },
  SNS_SENDER_ID: {
    type: "string",
    required: false,
  },
  SNS_ALLOWED_ORGANIZATIONS: {
    type: "string",
    required: false,
  },
  WEBHOOK_URL_BASE: { type: "string", required: true },
  FEATURE_FLAGS_URL: {
    type: "string",
    required: false,
  },
  FEATURE_FLAGS_TOKEN: {
    type: "string",
    required: false,
  },
  SUPPORT_ORGANISATION_ID: {
    type: "string",
    required: false,
    default: "support",
  },
  LOGTO_M2M_ANALYTICS_ORGANIZATION_ID: {
    type: "string",
    required: false,
  },
  ANALYTICS_URL: {
    type: "string",
    required: false,
  },
  ANALYTICS_MATOMO_TOKEN: {
    type: "string",
    required: false,
  },
  ANALYTICS_WEBSITE_ID: {
    type: "string",
    required: false,
  },
  ANALYTICS_DRY_RUN: {
    type: "boolean",
    required: false,
  },
};

const allKeys = Object.keys(EnvKeys);
const required = allKeys.filter((keyName) => EnvKeys[keyName].required);
const properties = allKeys.reduce(
  (
    accumulator: Record<
      string,
      { type: string; default?: number | boolean | string }
    >,
    key: string,
  ) => {
    accumulator[key] = {
      type: EnvKeys[key].type,
      default: EnvKeys[key].default,
    };

    return accumulator;
  },
  {},
);

const schema = {
  type: "object",
  required,
  properties,
};

export const autoConfig = {
  schema,
  dotenv: { quiet: true },
};

export default env;
