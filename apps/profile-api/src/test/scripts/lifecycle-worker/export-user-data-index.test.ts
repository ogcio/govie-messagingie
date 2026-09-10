import type { Pool } from "pg";
import pino from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { M2MSdksConfig } from "~/plugins/external/env.js";
import type { AuditLogger } from "~/utils/audit-logger.js";

const getProfile = vi.fn();
vi.mock("~/services/profiles/get-profile.js", () => ({
  getProfile: (...args: unknown[]) => getProfile(...args),
}));

vi.mock("~/utils/authentication-factory.js", () => ({
  getLifecycleWorkerM2MSdk: vi.fn(() => ({
    messaging: { support: { tag: "messaging-support" } },
    upload: { support: { tag: "upload-support" } },
  })),
}));

const downloadAndZipFiles = vi.fn();
const getSharedFileIdsForUsers = vi.fn((..._args: unknown[]) => ({
  success: true,
  fileIdsByUserId: {},
}));
vi.mock("~/scripts/lifecycle-worker/steps/export-user-data/files.js", () => ({
  downloadAndZipFiles: (...args: unknown[]) => downloadAndZipFiles(...args),
  getSharedFileIdsForUsers: (...args: unknown[]) =>
    getSharedFileIdsForUsers(...args),
}));

const getMessagesForUsers = vi.fn();
vi.mock(
  "~/scripts/lifecycle-worker/steps/export-user-data/messages.js",
  () => ({
    getMessagesForUsers: (...args: unknown[]) => getMessagesForUsers(...args),
  }),
);

const notifyExportReady = vi.fn();
vi.mock("~/scripts/lifecycle-worker/steps/export-user-data/notify.js", () => ({
  notifyExportReady: (...args: unknown[]) => notifyExportReady(...args),
}));

const uploadExportArchive = vi.fn();
vi.mock("~/scripts/lifecycle-worker/steps/export-user-data/upload.js", () => ({
  uploadExportArchive: (...args: unknown[]) => uploadExportArchive(...args),
}));

import { exportUserDataSdk } from "~/scripts/lifecycle-worker/steps/export-user-data/index.js";

const buildAuditLogger = () =>
  ({
    defaultValues: { metadata: { lifecycle_task_id: "task-1" } },
    safeSendLogs: vi
      .fn()
      .mockResolvedValue({ data: [{ id: "audit-parent-1" }] }),
  }) as unknown as AuditLogger<"user_id" | "metadata" | "client_timestamp">;

const baseParams = () => ({
  profileId: "profile-1",
  auditLogger: buildAuditLogger(),
  logger: pino({ enabled: false }),
  m2mConfig: {} as M2MSdksConfig,
  pool: {} as Pool,
  notifyUser: true,
});

describe("exportUserDataSdk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProfile.mockResolvedValue({
      id: "profile-1",
      publicName: "Test User",
      linkedProfiles: [{ id: "linked-1" }],
    });
    getMessagesForUsers.mockResolvedValue({
      success: true,
      data: { "profile-1": [{ id: "m1" }] },
    });
    downloadAndZipFiles.mockResolvedValue({ success: true });
    uploadExportArchive.mockResolvedValue({ uploadId: "upload-1" });
    notifyExportReady.mockResolvedValue(undefined);
  });

  it("exports profile + linked profiles, uploads, and notifies", async () => {
    const result = await exportUserDataSdk(baseParams());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toEqual({
        uploadId: "upload-1",
        expiresAt: expect.any(String),
      });
    }
    // Own profile + linked profile loaded for export.
    expect(getMessagesForUsers).toHaveBeenCalledWith(
      expect.objectContaining({ userIds: ["profile-1", "linked-1"] }),
    );
    expect(notifyExportReady).toHaveBeenCalledWith(
      expect.objectContaining({ notifyUser: true }),
    );
  });

  it("fails when messages cannot be fetched", async () => {
    getMessagesForUsers.mockResolvedValue({
      success: false,
      error: new Error("messaging down"),
    });

    const result = await exportUserDataSdk(baseParams());

    expect(result).toEqual({
      success: false,
      error: new Error("messaging down"),
    });
    expect(uploadExportArchive).not.toHaveBeenCalled();
  });

  it("fails when file download/zip fails", async () => {
    downloadAndZipFiles.mockResolvedValue({
      success: false,
      error: new Error("download failed"),
    });

    const result = await exportUserDataSdk(baseParams());

    expect(result).toEqual({
      success: false,
      error: new Error("download failed"),
    });
    expect(uploadExportArchive).not.toHaveBeenCalled();
  });

  it("fails when the archive upload fails", async () => {
    uploadExportArchive.mockResolvedValue({
      error: new Error("upload failed"),
    });

    const result = await exportUserDataSdk(baseParams());

    expect(result).toEqual({
      success: false,
      error: new Error("upload failed"),
    });
    expect(notifyExportReady).not.toHaveBeenCalled();
  });

  it("returns a failure when a step throws unexpectedly", async () => {
    downloadAndZipFiles.mockRejectedValue(new Error("stream exploded"));

    const result = await exportUserDataSdk(baseParams());

    expect(result).toEqual({
      success: false,
      error: new Error("stream exploded"),
    });
  });

  it("handles a profile without linked profiles and no parent audit id", async () => {
    getProfile.mockResolvedValue({
      id: "profile-1",
      publicName: "Test User",
      linkedProfiles: undefined,
    });
    const params = baseParams();
    (
      params.auditLogger.safeSendLogs as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ data: [] });
    params.auditLogger = {
      ...params.auditLogger,
      defaultValues: {},
      safeSendLogs: vi.fn().mockResolvedValue({ data: [] }),
    } as unknown as typeof params.auditLogger;

    const result = await exportUserDataSdk(params);

    expect(result.success).toBe(true);
    expect(getMessagesForUsers).toHaveBeenCalledWith(
      expect.objectContaining({ userIds: ["profile-1"] }),
    );
  });
});
