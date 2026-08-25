import type { Messaging } from "@ogcio/building-blocks-sdk/dist/types/index.js";
import type pino from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  notifyExportReady,
  shouldNotifyRequester,
} from "~/scripts/lifecycle-worker/steps/export-user-data/notify.js";
import { AuditLogResourceTypes } from "~/types/audit-logger.js";
import type { AuditLogger } from "~/utils/audit-logger.js";

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as pino.Logger;

const profile = {
  id: "profile-1",
  publicName: "A B",
  preferredLanguage: "en" as const,
};

const auditEntryDefaults = {
  action_type: "read" as const,
  resource_type: AuditLogResourceTypes.ExportUserData,
  parent_log_entry_id: undefined,
};

function buildAuditLogger() {
  const safeSendLogs = vi.fn(async () => ({ data: [{ id: "log-1" }] }));
  return {
    logger: { safeSendLogs } as unknown as AuditLogger<
      "user_id" | "metadata" | "client_timestamp"
    >,
    safeSendLogs,
  };
}

describe("shouldNotifyRequester", () => {
  it("notifies when the citizen requested the export", () => {
    expect(shouldNotifyRequester({ requester_application_id: null })).toBe(
      true,
    );
  });

  it("does not notify when an application requested the export", () => {
    expect(
      shouldNotifyRequester({ requester_application_id: "support-app-1" }),
    ).toBe(false);
  });
});

describe("notifyExportReady", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends the message and audits it when notifyUser is true", async () => {
    const send = vi.fn(async () => ({ data: { id: "message-1" } }));
    const audit = buildAuditLogger();

    await notifyExportReady({
      notifyUser: true,
      profile,
      messagingSupportSdk: { send } as unknown as Messaging["support"],
      logger,
      auditLogger: audit.logger,
      auditEntryDefaults,
      auditMetadataDefaults: { default: "metadata" },
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({
      recipientUserId: "profile-1",
      security: "public",
    });
    expect(audit.safeSendLogs).toHaveBeenCalledTimes(1);
    expect(audit.safeSendLogs.mock.calls[0][0][0]).toMatchObject({
      metadata: {
        default: "metadata",
        action: "sent_export_succeeded_message",
        message_id: "message-1",
      },
    });
  });

  it("sends nothing but still audits the skip when notifyUser is false", async () => {
    const send = vi.fn(async () => ({ data: { id: "message-1" } }));
    const audit = buildAuditLogger();

    await notifyExportReady({
      notifyUser: false,
      profile,
      messagingSupportSdk: { send } as unknown as Messaging["support"],
      logger,
      auditLogger: audit.logger,
      auditEntryDefaults,
      auditMetadataDefaults: { default: "metadata" },
    });

    expect(send).not.toHaveBeenCalled();
    expect(audit.safeSendLogs).toHaveBeenCalledTimes(1);
    expect(audit.safeSendLogs.mock.calls[0][0][0]).toMatchObject({
      metadata: {
        default: "metadata",
        action: "skipped_export_succeeded_message",
        reason: "requested_by_application",
      },
    });
  });

  it("audits the failure reason when the message send fails", async () => {
    const send = vi.fn(async () => ({
      error: { detail: "recipient unreachable" },
    }));
    const audit = buildAuditLogger();

    await notifyExportReady({
      notifyUser: true,
      profile,
      messagingSupportSdk: { send } as unknown as Messaging["support"],
      logger,
      auditLogger: audit.logger,
      auditEntryDefaults,
      auditMetadataDefaults: {},
    });

    expect(audit.safeSendLogs.mock.calls[0][0][0]).toMatchObject({
      metadata: {
        action: "sent_export_succeeded_message",
        message_error: "recipient unreachable",
      },
    });
  });
});
