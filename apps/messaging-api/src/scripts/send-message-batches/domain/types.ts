import type {
  BatchRunStatusValue,
  MessageSendStatusValue,
  RecipientResolutionStatusValue,
  SendAtModeValue,
} from "./statuses.js";

export type RunCommand = {
  kind: "run";
  forceNew: boolean;
  sendAt: string | undefined;
  eventSyncDelaySeconds: number | undefined;
};

export type StatusCommand = {
  kind: "status";
  runId: string | undefined;
  sendAt: string | undefined;
};

export type CliCommand = RunCommand | StatusCommand;

export interface DatabaseConfig {
  user: string;
  password: string;
  host: string;
  port: number;
  databaseName: string;
}

export interface ResolvedSendAt {
  sendAtMode: SendAtModeValue;
  fingerprintValue: string;
  scheduleAt: Date;
  sendAtValue: Date | null;
}

export interface LoadedConfig {
  command: CliCommand;
  database: DatabaseConfig;
  logtoOidcEndpoint: string;
  publicServantClientId: string;
  publicServantClientSecret: string;
  publicServantOrganizationId: string;
  publicServantScopes: string;
  profileBackendUrl: string;
  messagingBackendUrl: string;
  recipientsCsvPath: string;
  htmlTemplatePath: string;
  txtTemplatePath: string;
  messageSubject: string;
  sendBatchSize: number;
  sendBatchDelayMs: number;
  eventSyncDelaySeconds: number;
  richTextEncodeBase64: boolean;
}

export interface FingerprintInput {
  organizationId: string;
  recipientsCsvPath: string;
  htmlTemplatePath: string;
  txtTemplatePath: string;
  messageSubject: string;
  templateVariablesSchemaVersion: string;
  resolvedSendAt: ResolvedSendAt;
}

export interface FingerprintResult {
  runFingerprint: string;
  csvContentHash: string;
  htmlContentHash: string;
  txtContentHash: string;
}

export interface BatchRunRecord {
  id: string;
  runFingerprint: string;
  status: BatchRunStatusValue;
  organizationId: string;
  messageSubject: string;
  sendAtMode: SendAtModeValue;
  sendAtValue: Date | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface RunSummary {
  runId: string;
  runStatus: BatchRunStatusValue;
  runFingerprint: string;
  organizationId: string;
  messageSubject: string;
  sendAtMode: SendAtModeValue;
  sendAtValue: Date | null;
  totalRecipients: number;
  resolvedRecipients: number;
  unresolvedRecipients: number;
  duplicateRecipients: number;
  totalMessages: number;
  pendingMessages: number;
  sentMessages: number;
  terminalSendFailureMessages: number;
  messagesWithSnapshot: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  awaitingSnapshots: number;
}

export interface PendingRecipient {
  id: string;
  csvRowNumber: number;
  rawEmail: string;
  normalizedEmail: string;
}

export interface ProfileMatch {
  profileId: string;
  publicName: string | null;
  email: string;
  consentStatus: string | null;
  profileStatus: string | null;
}

export interface PendingMessage {
  id: string;
  profileId: string;
  recipientEmail: string;
  templatePublicName: string | null;
  templateEmail: string;
  scheduleAt: Date;
}

export interface DeliveryEvent {
  eventType: string;
  eventStatus: string;
  eventPayload: Record<string, unknown>;
  eventAt: Date;
}

export interface MessageContent {
  threadName: string;
  subject: string;
  excerpt: string;
  plainText: string;
  richText?: string;
}

export interface SendMessageRequest {
  recipientProfileId: string;
  recipientEmail: string;
  scheduleAt: Date;
  content: MessageContent;
}

export interface GroupedReportCount {
  label: string;
  count: number;
}

export interface RunStatusReport {
  summary: RunSummary;
  unresolvedRecipientReasons: GroupedReportCount[];
  terminalSendFailureReasons: GroupedReportCount[];
  failedDeliveryStatuses: GroupedReportCount[];
  deliverySyncReadiness: {
    tooNewForSync: number;
    eligibleWithoutSnapshot: number;
  };
}

export interface BatchRunStore {
  findLatestUnfinishedRunByFingerprint(
    runFingerprint: string,
  ): Promise<BatchRunRecord | null>;
  findRunById(runId: string): Promise<BatchRunRecord | null>;
  createRun(params: {
    runFingerprint: string;
    organizationId: string;
    messageSubject: string;
    sendAtMode: SendAtModeValue;
    sendAtValue: Date | null;
    csvContentHash: string;
    htmlContentHash: string;
    txtContentHash: string;
    templateVariablesSchemaVersion: string;
    operationalSettingsSnapshot: Record<string, unknown>;
  }): Promise<BatchRunRecord>;
  supersedeUnfinishedRunsByFingerprint(runFingerprint: string): Promise<number>;
  insertRecipients(
    runId: string,
    recipients: Array<{
      csvRowNumber: number;
      rawEmail: string;
      normalizedEmail: string;
    }>,
  ): Promise<void>;
  listPendingRecipients(runId: string): Promise<PendingRecipient[]>;
  markRecipientResolved(params: {
    recipientId: string;
    profileId: string;
    publicName: string | null;
    profileEmail: string;
    consentStatus: string | null;
    profileStatus: string | null;
    canonicalMessageId: string;
  }): Promise<void>;
  markRecipientUnresolved(params: {
    recipientId: string;
    reason: string;
    profileId?: string | null;
    publicName?: string | null;
    profileEmail?: string | null;
    consentStatus?: string | null;
    profileStatus?: string | null;
  }): Promise<void>;
  markRecipientDuplicate(params: {
    recipientId: string;
    canonicalMessageId: string;
    profileId?: string | null;
    publicName?: string | null;
    profileEmail?: string | null;
    consentStatus?: string | null;
    profileStatus?: string | null;
  }): Promise<void>;
  findCanonicalMessageByProfileId(
    runId: string,
    profileId: string,
  ): Promise<{ id: string } | null>;
  createPendingMessage(params: {
    runId: string;
    sourceRecipientId: string;
    profileId: string;
    recipientEmail: string;
    templatePublicName: string | null;
    templateEmail: string;
    scheduleAt: Date;
  }): Promise<{ id: string }>;
  listPendingMessages(runId: string): Promise<PendingMessage[]>;
  markMessageSent(params: {
    messageId: string;
    externalMessageId: string;
    renderedSubject: string;
    renderedPlainText: string;
    renderedRichText?: string;
  }): Promise<void>;
  markMessageTerminalFailure(
    messageId: string,
    sendError: string,
  ): Promise<void>;
  listMessagesEligibleForDeliverySync(
    runId: string,
    eventSyncDelaySeconds: number,
    now: Date,
  ): Promise<Array<{ id: string; externalMessageId: string }>>;
  countMessagesTooNewForDeliverySync(
    runId: string,
    eventSyncDelaySeconds: number,
    now: Date,
  ): Promise<number>;
  listUnresolvedRecipientReasonCounts(
    runId: string,
  ): Promise<GroupedReportCount[]>;
  listTerminalSendFailureReasonCounts(
    runId: string,
  ): Promise<GroupedReportCount[]>;
  listFailedDeliveryStatusCounts(runId: string): Promise<GroupedReportCount[]>;
  markDeliverySyncAttempted(
    messageId: string,
    attemptedAt: Date,
  ): Promise<void>;
  storeLatestDeliverySnapshot(params: {
    messageId: string;
    snapshot: DeliveryEvent;
    syncedAt: Date;
  }): Promise<void>;
  updateRunStatus(
    runId: string,
    status: BatchRunStatusValue,
    latestError?: string,
  ): Promise<void>;
  completeRun(runId: string, status: BatchRunStatusValue): Promise<void>;
  getRunSummary(runId: string): Promise<RunSummary | null>;
  findLatestRunSummaryByFingerprint(
    runFingerprint: string,
  ): Promise<RunSummary | null>;
}

export interface ProfileClient {
  findProfile(normalizedEmail: string): Promise<ProfileMatch[]>;
}

export interface MessagingClient {
  sendMessage(request: SendMessageRequest): Promise<{ messageId: string }>;
  getEventsForMessage(messageId: string): Promise<DeliveryEvent[]>;
}

export interface PublicServantTokenClient {
  getAccessToken(): Promise<string>;
}

export interface LoggerAdapter {
  debug(fields: Record<string, unknown>, message: string): void;
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
  error(fields: Record<string, unknown>, message: string): void;
}

export interface BatchRecipientRecord {
  id: string;
  resolutionStatus: RecipientResolutionStatusValue;
}

export interface BatchMessageRecord {
  id: string;
  sendStatus: MessageSendStatusValue;
}
