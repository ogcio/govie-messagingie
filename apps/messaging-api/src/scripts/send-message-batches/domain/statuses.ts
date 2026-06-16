export const BatchRunStatus = {
  Created: "created",
  ResolvingRecipients: "resolving_recipients",
  ReadyToSend: "ready_to_send",
  Sending: "sending",
  ReadyToSyncDelivery: "ready_to_sync_delivery",
  SyncingDelivery: "syncing_delivery",
  Completed: "completed",
  CompletedWithFailures: "completed_with_failures",
  Failed: "failed",
  Superseded: "superseded",
} as const;

export type BatchRunStatusValue =
  (typeof BatchRunStatus)[keyof typeof BatchRunStatus];

export const RecipientResolutionStatus = {
  Pending: "pending",
  Resolved: "resolved",
  Unresolved: "unresolved",
  Duplicate: "duplicate",
} as const;

export type RecipientResolutionStatusValue =
  (typeof RecipientResolutionStatus)[keyof typeof RecipientResolutionStatus];

export const MessageSendStatus = {
  Pending: "pending",
  Sent: "sent",
  TerminalSendFailure: "terminal_send_failure",
} as const;

export type MessageSendStatusValue =
  (typeof MessageSendStatus)[keyof typeof MessageSendStatus];

export const SendAtMode = {
  Immediate: "immediate",
  Scheduled: "scheduled",
} as const;

export type SendAtModeValue = (typeof SendAtMode)[keyof typeof SendAtMode];

export const ALLOWED_TEMPLATE_VARIABLES = ["publicName", "email"] as const;

export type AllowedTemplateVariable =
  (typeof ALLOWED_TEMPLATE_VARIABLES)[number];

export const TemplateVariablesSchemaVersion = "v1";
