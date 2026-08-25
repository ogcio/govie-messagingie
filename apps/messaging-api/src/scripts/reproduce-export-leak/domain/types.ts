export type SubcommandKind = "seed" | "cleanup";

export type SeedCommand = {
  kind: "seed";
  symmetric: boolean;
  confirm: boolean;
};

export type CleanupCommand = {
  kind: "cleanup";
  fileId: string | undefined;
  userId: string | undefined;
  purge: boolean;
  confirm: boolean;
};

export type CliCommand = SeedCommand | CleanupCommand;

/**
 * Resolved base URLs and OIDC endpoint for the target environment. Every host
 * has already passed the production guard by the time this object exists.
 */
export interface ResolvedEndpoints {
  environmentLabel: string;
  uploadBaseUrl: string;
  messagingBaseUrl: string;
  profileBaseUrl: string;
  logtoOidcEndpoint: string;
}

export interface OrgM2MCredentials {
  applicationId: string;
  applicationSecret: string;
}

/**
 * Everything the seed/cleanup subcommands need.
 */
export interface LoadedConfig {
  command: CliCommand;
  endpoints: ResolvedEndpoints;
  organizationId: string;
  user1: string;
  user2: string;
  messagingM2M: OrgM2MCredentials;
  uploadM2M: OrgM2MCredentials;
  profileM2M: OrgM2MCredentials;
}

export interface ResolvedUser {
  identifier: string;
  profileId: string;
  resolvedVia: "email" | "profileId";
}

export interface Logger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}
