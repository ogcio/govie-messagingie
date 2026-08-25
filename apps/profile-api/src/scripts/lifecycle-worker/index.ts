import { getDbEnvs } from "~/migrations/scripts/shared.js";
import type {
  DPProxyConfig,
  LogtoManagementConfig,
  M2MSdksConfig,
} from "~/plugins/external/env.js";
import { startWorkerLoop } from "./lifecycle-worker-loop.js";

await startWorkerLoop({
  envDbConfig: getDbEnvs(),
  logtoManagementConfig: getLogtoManagementConfig(),
  dpProxyConfig: getDpProxyConfig(),
  m2mSdksConfig: getM2MSdksConfig(),
});

function getDpProxyConfig(): Required<DPProxyConfig> {
  const dpProxyUrl = process.env.DP_PROXY_API_BASE_URL;
  const dpProxyToken = process.env.DP_PROXY_WEBHOOK_ACCESS_TOKEN;

  if (!dpProxyToken) {
    throw new Error("DP_PROXY_WEBHOOK_ACCESS_TOKEN is not defined");
  }
  if (!dpProxyUrl) {
    throw new Error("DP_PROXY_API_BASE_URL is not defined");
  }
  return {
    DP_PROXY_API_BASE_URL: dpProxyUrl,
    DP_PROXY_WEBHOOK_ACCESS_TOKEN: dpProxyToken,
  };
}

function getLogtoManagementConfig(): LogtoManagementConfig {
  const envs: Partial<LogtoManagementConfig> = {
    LOGTO_MANAGEMENT_API_ENDPOINT: process.env.LOGTO_MANAGEMENT_API_ENDPOINT,
    LOGTO_MANAGEMENT_API_CLIENT_ID: process.env.LOGTO_MANAGEMENT_API_CLIENT_ID,
    LOGTO_MANAGEMENT_API_RESOURCE_URL:
      process.env.LOGTO_MANAGEMENT_API_RESOURCE_URL,
    LOGTO_MANAGEMENT_API_CLIENT_SECRET:
      process.env.LOGTO_MANAGEMENT_API_CLIENT_SECRET,
    LOGTO_OIDC_ENDPOINT: process.env.LOGTO_OIDC_ENDPOINT,
  };

  for (const key in Object.keys(envs)) {
    if (!key) {
      throw new Error(`Cannot run worker, ${key} is missing`);
    }
  }

  return envs as LogtoManagementConfig;
}

function getM2MSdksConfig(): M2MSdksConfig {
  const envs: Partial<M2MSdksConfig> = {
    AUDIT_COLLECTOR_URL: process.env.AUDIT_COLLECTOR_URL,
    SCHEDULER_BACKEND_URL: process.env.SCHEDULER_BACKEND_URL,
    LOGTO_OIDC_ENDPOINT: process.env.LOGTO_OIDC_ENDPOINT,
    LOGTO_M2M_SCHEDULER_APP_ID: process.env.LOGTO_M2M_SCHEDULER_APP_ID,
    LOGTO_M2M_SCHEDULER_APP_SECRET: process.env.LOGTO_M2M_SCHEDULER_APP_SECRET,
    LOGTO_M2M_LIFECYCLE_APP_ID: process.env.LOGTO_M2M_LIFECYCLE_APP_ID,
    LOGTO_M2M_LIFECYCLE_APP_SECRET: process.env.LOGTO_M2M_LIFECYCLE_APP_SECRET,
    UPLOAD_BACKEND_URL: process.env.UPLOAD_BACKEND_URL,
    MESSAGING_BACKEND_URL: process.env.MESSAGING_BACKEND_URL,
  };

  for (const key in Object.keys(envs)) {
    if (!key) {
      throw new Error(`Cannot run worker, ${key} is missing`);
    }
  }

  return envs as M2MSdksConfig;
}
