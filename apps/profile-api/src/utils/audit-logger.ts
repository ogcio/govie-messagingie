import type { BuildingBlocksSDK } from "@ogcio/building-blocks-sdk";
import type pino from "pino";
import {
  AUDIT_LOG_APPLICATION_ID,
  type AuditLogInput,
  type MandatoryAuditLogKey,
} from "~/types/audit-logger.js";

export class AuditLogger<
  DefaultKeys extends keyof AuditLogInput = "application_id",
> {
  readonly defaultValues: Pick<AuditLogInput, DefaultKeys | "application_id">;

  constructor(
    private readonly auditCollectorClient: BuildingBlocksSDK["auditCollector"],
    defaults?: Pick<AuditLogInput, DefaultKeys>,
    readonly logger?: pino.Logger,
  ) {
    this.defaultValues = {
      application_id: AUDIT_LOG_APPLICATION_ID,
      ...defaults,
    } as Pick<AuditLogInput, DefaultKeys | "application_id">;
  }

  async sendLogs(
    logs: (Partial<AuditLogInput> &
      Pick<AuditLogInput, Exclude<MandatoryAuditLogKey, DefaultKeys>>)[],
  ) {
    const sdk = this.auditCollectorClient;
    const mergedLogs = logs.map(
      (log) => ({ ...this.defaultValues, ...log }) as AuditLogInput,
    );

    return sdk.sendLogs(mergedLogs);
  }

  async safeSendLogs(
    logs: (Partial<AuditLogInput> &
      Pick<AuditLogInput, Exclude<MandatoryAuditLogKey, DefaultKeys>>)[],
  ): Promise<
    undefined | ReturnType<BuildingBlocksSDK["auditCollector"]["sendLogs"]>
  > {
    try {
      return await this.sendLogs(logs);
    } catch (err) {
      if (this.logger) {
        this.logger.warn({ error: err }, "[Audit Logger] Failed to send logs");
      }
      // swallow the error to avoid impacting the main flow
    }
  }
}
