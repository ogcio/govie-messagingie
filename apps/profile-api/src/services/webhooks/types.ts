import type { FastifyBaseLogger } from "fastify";
import type { Pool, PoolClient } from "pg";
import type { LogtoClient } from "~/clients/logto.js";
import type { EnvConfig } from "~/plugins/external/env.js";
import type { ConsentStatementWithTranslations } from "~/schemas/consent-statements/shared.js";
import type { ConsentSubject } from "~/schemas/consents/shared.js";
import type { LogtoUserCreatedBody } from "~/schemas/webhooks/logto-user-created.js";
import type { WebhookUser } from "./webhook-body-to-user.js";

export interface WebhookResponse {
  id: string | undefined;
  error?: string;
  status: "success" | "error";
}

export interface WebhookProcessingParams {
  body: LogtoUserCreatedBody;
  pool: Pool;
  logger: FastifyBaseLogger;
  config: EnvConfig;
  getLogtoClient: () => Promise<LogtoClient>;
}

export interface ProfileImportParams {
  user: WebhookUser;
  pool: Pool;
  logger: FastifyBaseLogger;
  config: EnvConfig;
  insertPrivateDetails: boolean;
  onlyPrivateDetails: boolean;
  currentConsentStatement: ConsentStatementWithTranslations | null;
}

export interface DirectSigninParams {
  user: WebhookUser;
  pool: Pool;
  logger: FastifyBaseLogger;
  currentConsentStatement: ConsentStatementWithTranslations | null;
  getLogtoClient: () => Promise<LogtoClient>;
  isFlagEnabled: boolean;
}

export interface ConsentProcessingParams {
  client: PoolClient;
  subject: ConsentSubject;
  userId: string;
  logger: FastifyBaseLogger;
  currentConsentStatement: ConsentStatementWithTranslations | null;
  isFlagEnabled: boolean;
}

export interface AccountLinkingParams {
  client: PoolClient;
  primaryUserId: string;
  linkedProfileId: string;
  logger: FastifyBaseLogger;
  currentConsentStatement: ConsentStatementWithTranslations | null;
}

export interface ProfileCreationData {
  id: string;
  email: string;
  publicName: string;
  primaryUserId?: string;
  safeLevel?: number;
}
