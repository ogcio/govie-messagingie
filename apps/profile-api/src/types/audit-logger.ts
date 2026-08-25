import type { BuildingBlocksSDK } from "@ogcio/building-blocks-sdk";

export const AUDIT_LOG_APPLICATION_ID = "profile-api";

export const AuditLogResourceTypes = {
  LifecycleTask: "lifecycle_task",
  Profile: "profile",
  ExportUserData: "export_user_data",
};

export type AuditLogResourceType =
  (typeof AuditLogResourceTypes)[keyof typeof AuditLogResourceTypes];

export type AuditLogInput = Parameters<
  BuildingBlocksSDK["auditCollector"]["sendLogs"]
>[0][number];

export type MandatoryAuditLogFields = Pick<
  AuditLogInput,
  "client_timestamp" | "resource_type" | "action_type" | "metadata"
>;

export type MandatoryAuditLogKey = keyof MandatoryAuditLogFields;
