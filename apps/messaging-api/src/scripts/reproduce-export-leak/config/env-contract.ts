/**
 * Declarative contract of every environment variable the reproduce-export-leak
 * task reads. `.env.sample` lists exactly these names (values omitted). Keeping
 * the list here lets `load-config` validate presence and lets the README stay
 * in sync with the code.
 */

export const KNOWN_ENVIRONMENTS = {
  dev: {
    label: "dev",
    uploadBaseUrl: "https://upload-api.dev.services.gov.ie",
    messagingBaseUrl: "https://messaging-api.dev.services.gov.ie",
    profileBaseUrl: "https://profile-api.dev.services.gov.ie",
    logtoOidcEndpoint: "https://authorization.dev.services.gov.ie/oidc/",
  },
  uat: {
    label: "uat",
    uploadBaseUrl: "https://upload-api.uat.services.gov.ie",
    messagingBaseUrl: "https://messaging-api.uat.services.gov.ie",
    profileBaseUrl: "https://profile-api.uat.services.gov.ie",
    logtoOidcEndpoint: "https://authorization.uat.services.gov.ie/oidc/",
  },
} as const;

export type KnownEnvironmentKey = keyof typeof KNOWN_ENVIRONMENTS;

/**
 * Default recipients for dev and uat.
 *
 *   user1 (exporter / leak RECIPIENT) = andrea — a real MyGovID account that
 *     logs into the citizen portal to verify the leak MANUALLY through the UI.
 *     This is the person whose data export ends up containing someone else's
 *     file.
 *       dev: andrea.pregnolato+testdev@nearform.com  profileId 86yzcekv9bte
 *       uat: andrea.pregnolato@pm.me                  profileId ybogyi9hneb7
 *   user2 (owner of the leaked file) = e2e_citizen_user_2 — verified clean (no
 *     pre-existing org import or files) in dev AND uat.
 *       profileId e2e-cit-2  email e2e_citizen_2@user.com  PPSN E2E_CITIZEN_USER_2
 *
 * Values are profile ids so the seed happy path skips `findProfile`; the profile
 * org token only needs profile:user:read.
 */
export const USER_DEFAULTS = {
  dev: {
    user1: "86yzcekv9bte",
    user2: "e2e-cit-2",
  },
  uat: {
    user1: "ybogyi9hneb7",
    user2: "e2e-cit-2",
  },
} as const;

/**
 * All env var names, grouped for documentation. The `.env.sample` file is
 * generated from this list, so any new variable must be added here.
 */
export const ENV_KEYS = {
  // Environment selection (either REPRO_ENV, or the four explicit base URLs).
  environment: [
    "REPRO_ENV",
    "REPRO_UPLOAD_BASE_URL",
    "REPRO_MESSAGING_BASE_URL",
    "REPRO_PROFILE_BASE_URL",
    "REPRO_LOGTO_OIDC_ENDPOINT",
  ],
  // Organisation-scoped M2M credentials for seed/cleanup (client_credentials).
  orgCredentials: [
    "REPRO_ORGANIZATION_ID",
    "REPRO_MESSAGING_M2M_APP_ID",
    "REPRO_MESSAGING_M2M_APP_SECRET",
    "REPRO_UPLOAD_M2M_APP_ID",
    "REPRO_UPLOAD_M2M_APP_SECRET",
    "REPRO_PROFILE_M2M_APP_ID",
    "REPRO_PROFILE_M2M_APP_SECRET",
  ],
  // Target users and safety confirmation.
  targets: ["REPRO_USER1", "REPRO_USER2", "REPRO_CONFIRM"],
} as const;

export const ALL_ENV_KEYS: readonly string[] = [
  ...ENV_KEYS.environment,
  ...ENV_KEYS.orgCredentials,
  ...ENV_KEYS.targets,
];

export function getTrimmedEnv(
  env: NodeJS.ProcessEnv,
  key: string,
): string | undefined {
  const value = env[key];
  if (value == null) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}
