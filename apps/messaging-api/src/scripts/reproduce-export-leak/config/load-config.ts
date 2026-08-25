import type {
  CliCommand,
  LoadedConfig,
  OrgM2MCredentials,
  ResolvedEndpoints,
} from "../domain/types.js";
import {
  assertEnvironmentNotProduction,
  assertNodeEnvNotProduction,
} from "../safety/assert-non-prod.js";
import {
  getTrimmedEnv,
  KNOWN_ENVIRONMENTS,
  type KnownEnvironmentKey,
  USER_DEFAULTS,
} from "./env-contract.js";

type LoadConfigInput = {
  env: NodeJS.ProcessEnv;
  command: CliCommand;
};

export function loadConfig({ env, command }: LoadConfigInput): LoadedConfig {
  assertNodeEnvNotProduction(env);

  const problems: string[] = [];
  const endpoints = resolveEndpoints(env, problems);

  const organizationId = requireEnv(env, "REPRO_ORGANIZATION_ID", problems);
  const messagingM2M = readOrgCredentials(env, "REPRO_MESSAGING_M2M", problems);
  const uploadM2M = readOrgCredentials(env, "REPRO_UPLOAD_M2M", problems);
  const profileM2M = readOrgCredentials(env, "REPRO_PROFILE_M2M", problems);

  const { user1, user2 } = resolveUsers(env, endpoints, problems);

  if (problems.length > 0) {
    throw new Error(
      `Invalid reproduce-export-leak config:\n  - ${problems.join("\n  - ")}`,
    );
  }

  // Guard AFTER endpoints resolved so we can inspect every host, but BEFORE the
  // config is handed to any subcommand that could mutate data.
  assertEnvironmentNotProduction({
    environmentLabel: endpoints.environmentLabel,
    hosts: [
      endpoints.uploadBaseUrl,
      endpoints.messagingBaseUrl,
      endpoints.profileBaseUrl,
      endpoints.logtoOidcEndpoint,
    ],
  });

  return {
    command,
    endpoints,
    organizationId: organizationId ?? "",
    user1: user1 ?? "",
    user2: user2 ?? "",
    messagingM2M: messagingM2M ?? emptyOrgCredentials(),
    uploadM2M: uploadM2M ?? emptyOrgCredentials(),
    profileM2M: profileM2M ?? emptyOrgCredentials(),
  };
}

function resolveEndpoints(
  env: NodeJS.ProcessEnv,
  problems: string[],
): ResolvedEndpoints {
  const explicitUpload = getTrimmedEnv(env, "REPRO_UPLOAD_BASE_URL");
  const explicitMessaging = getTrimmedEnv(env, "REPRO_MESSAGING_BASE_URL");
  const explicitProfile = getTrimmedEnv(env, "REPRO_PROFILE_BASE_URL");
  const explicitLogto = getTrimmedEnv(env, "REPRO_LOGTO_OIDC_ENDPOINT");
  const reproEnv = getTrimmedEnv(env, "REPRO_ENV");

  const hasAnyExplicit =
    explicitUpload != null ||
    explicitMessaging != null ||
    explicitProfile != null ||
    explicitLogto != null;

  // Explicit base URLs take precedence over REPRO_ENV so an operator can point
  // at an ad-hoc environment.
  if (hasAnyExplicit) {
    return {
      environmentLabel: reproEnv ?? "custom",
      uploadBaseUrl: normalizeUrl(
        explicitUpload,
        "REPRO_UPLOAD_BASE_URL",
        problems,
      ),
      messagingBaseUrl: normalizeUrl(
        explicitMessaging,
        "REPRO_MESSAGING_BASE_URL",
        problems,
      ),
      profileBaseUrl: normalizeUrl(
        explicitProfile,
        "REPRO_PROFILE_BASE_URL",
        problems,
      ),
      logtoOidcEndpoint: normalizeUrl(
        explicitLogto,
        "REPRO_LOGTO_OIDC_ENDPOINT",
        problems,
        { trailingSlash: true },
      ),
    };
  }

  if (reproEnv == null) {
    problems.push(
      "either REPRO_ENV (dev|uat) or the explicit REPRO_*_BASE_URL vars are required",
    );
    return emptyEndpoints("");
  }

  const key = reproEnv.toLowerCase();
  if (!isKnownEnvironment(key)) {
    problems.push(
      `REPRO_ENV must be one of dev|uat (received "${reproEnv}"), or provide explicit REPRO_*_BASE_URL vars`,
    );
    return emptyEndpoints(reproEnv);
  }

  const preset = KNOWN_ENVIRONMENTS[key];
  return {
    environmentLabel: preset.label,
    uploadBaseUrl: preset.uploadBaseUrl,
    messagingBaseUrl: preset.messagingBaseUrl,
    profileBaseUrl: preset.profileBaseUrl,
    logtoOidcEndpoint: preset.logtoOidcEndpoint,
  };
}

function resolveUsers(
  env: NodeJS.ProcessEnv,
  endpoints: ResolvedEndpoints,
  problems: string[],
): { user1: string | undefined; user2: string | undefined } {
  const envKey = endpoints.environmentLabel.toLowerCase();
  const defaults = isKnownEnvironment(envKey)
    ? USER_DEFAULTS[envKey]
    : undefined;

  const user1 = getTrimmedEnv(env, "REPRO_USER1") ?? defaults?.user1;
  const user2 = getTrimmedEnv(env, "REPRO_USER2") ?? defaults?.user2;

  if (user1 == null) {
    problems.push("REPRO_USER1 is required (no default for this environment)");
  }
  if (user2 == null) {
    problems.push("REPRO_USER2 is required (no default for this environment)");
  }

  return { user1, user2 };
}

function readOrgCredentials(
  env: NodeJS.ProcessEnv,
  prefix: string,
  problems: string[],
): OrgM2MCredentials | undefined {
  const applicationId = requireEnv(env, `${prefix}_APP_ID`, problems);
  const applicationSecret = requireEnv(env, `${prefix}_APP_SECRET`, problems);

  if (applicationId == null || applicationSecret == null) {
    return undefined;
  }

  return { applicationId, applicationSecret };
}

function requireEnv(
  env: NodeJS.ProcessEnv,
  key: string,
  problems: string[],
): string | undefined {
  const value = getTrimmedEnv(env, key);
  if (value == null) {
    problems.push(`${key} is required`);
  }
  return value;
}

function normalizeUrl(
  value: string | undefined,
  key: string,
  problems: string[],
  options?: { trailingSlash?: boolean },
): string {
  if (value == null) {
    problems.push(`${key} is required`);
    return "";
  }

  try {
    const url = new URL(value);
    if (options?.trailingSlash === true && !url.pathname.endsWith("/")) {
      url.pathname = `${url.pathname}/`;
    }
    return url.toString();
  } catch {
    problems.push(`${key} must be a valid URL`);
    return "";
  }
}

function isKnownEnvironment(value: string): value is KnownEnvironmentKey {
  return Object.hasOwn(KNOWN_ENVIRONMENTS, value);
}

function emptyOrgCredentials(): OrgM2MCredentials {
  return { applicationId: "", applicationSecret: "" };
}

function emptyEndpoints(label: string): ResolvedEndpoints {
  return {
    environmentLabel: label,
    uploadBaseUrl: "",
    messagingBaseUrl: "",
    profileBaseUrl: "",
    logtoOidcEndpoint: "",
  };
}
