import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrgSdkClients } from "../../../scripts/reproduce-export-leak/clients/create-sdk-clients.js";
import type {
  CleanupCommand,
  LoadedConfig,
  Logger,
  SeedCommand,
} from "../../../scripts/reproduce-export-leak/domain/types.js";
import { runCleanup } from "../../../scripts/reproduce-export-leak/subcommands/cleanup.js";
import { runSeed } from "../../../scripts/reproduce-export-leak/subcommands/seed.js";

const logger: Logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const config = {
  endpoints: { environmentLabel: "dev" },
  user1: "profile-user-1",
  user2: "profile-user-2",
} as LoadedConfig;

function makeClients() {
  let uploadCount = 0;
  return {
    profile: { findProfile: vi.fn() },
    upload: {
      uploadFile: vi.fn().mockImplementation(async () => ({
        data: { uploadId: `file-${++uploadCount}` },
      })),
      shareFile: vi.fn().mockResolvedValue({}),
      removeFileSharing: vi.fn().mockResolvedValue(undefined),
      scheduleFileDeletion: vi.fn().mockResolvedValue({}),
    },
    messaging: {
      send: vi
        .fn()
        .mockImplementation(async () => ({ data: { id: "message-1" } })),
    },
  } as unknown as OrgSdkClients & {
    upload: {
      uploadFile: ReturnType<typeof vi.fn>;
      shareFile: ReturnType<typeof vi.fn>;
      removeFileSharing: ReturnType<typeof vi.fn>;
      scheduleFileDeletion: ReturnType<typeof vi.fn>;
    };
    messaging: { send: ReturnType<typeof vi.fn> };
    profile: { findProfile: ReturnType<typeof vi.fn> };
  };
}

const seedCommand: SeedCommand = {
  kind: "seed",
  symmetric: false,
  confirm: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runSeed", () => {
  it("uploads two files, sends two messages, and injects the leak share", async () => {
    const clients = makeClients();

    await runSeed({ config, command: seedCommand, clients, logger });

    expect(clients.upload.uploadFile).toHaveBeenCalledTimes(2);
    expect(clients.messaging.send).toHaveBeenCalledTimes(2);
    // 2 legitimate shares + 1 leak share (fileB -> user1)
    expect(clients.upload.shareFile).toHaveBeenCalledTimes(3);
    expect(clients.upload.shareFile).toHaveBeenLastCalledWith(
      "file-2",
      "profile-user-1",
    );
  });

  it("adds the symmetric share when --symmetric is set", async () => {
    const clients = makeClients();

    await runSeed({
      config,
      command: { ...seedCommand, symmetric: true },
      clients,
      logger,
    });

    expect(clients.upload.shareFile).toHaveBeenCalledTimes(4);
    expect(clients.upload.shareFile).toHaveBeenLastCalledWith(
      "file-1",
      "profile-user-2",
    );
  });

  it("surfaces upload failures with SDK error detail", async () => {
    const clients = makeClients();
    clients.upload.uploadFile.mockResolvedValueOnce({
      error: { detail: "upload rejected" },
    });

    await expect(
      runSeed({ config, command: seedCommand, clients, logger }),
    ).rejects.toThrow(/uploadFile failed for .*: upload rejected/);
  });

  it("surfaces share failures", async () => {
    const clients = makeClients();
    clients.upload.shareFile.mockResolvedValueOnce({
      error: { detail: "share denied" },
    });

    await expect(
      runSeed({ config, command: seedCommand, clients, logger }),
    ).rejects.toThrow(
      /shareFile\(file-1 -> profile-user-1\) failed: share denied/,
    );
  });

  it("surfaces messaging send failures", async () => {
    const clients = makeClients();
    clients.messaging.send.mockResolvedValueOnce({
      error: { detail: "send failed" },
    });

    await expect(
      runSeed({ config, command: seedCommand, clients, logger }),
    ).rejects.toThrow(/messaging.send to profile-user-1 failed: send failed/);
  });
});

describe("runCleanup", () => {
  const cleanupCommand: CleanupCommand = {
    kind: "cleanup",
    fileId: "file-2",
    userId: "profile-user-1",
    purge: false,
    confirm: true,
  };

  it("removes the leak share with explicit flags", async () => {
    const clients = makeClients();

    await runCleanup({ config, command: cleanupCommand, clients, logger });

    expect(clients.upload.removeFileSharing).toHaveBeenCalledWith(
      "file-2",
      "profile-user-1",
    );
    expect(clients.upload.scheduleFileDeletion).not.toHaveBeenCalled();
  });

  it("falls back to resolved user1 when --user-id is omitted", async () => {
    const clients = makeClients();

    await runCleanup({
      config,
      command: { ...cleanupCommand, userId: undefined },
      clients,
      logger,
    });

    // config.user1 has no "@", so it is used directly as profile id
    expect(clients.upload.removeFileSharing).toHaveBeenCalledWith(
      "file-2",
      "profile-user-1",
    );
  });

  it("requires --file-id", async () => {
    const clients = makeClients();

    await expect(
      runCleanup({
        config,
        command: { ...cleanupCommand, fileId: undefined },
        clients,
        logger,
      }),
    ).rejects.toThrow(/cleanup requires --file-id/);
  });

  it("schedules file deletion with --purge", async () => {
    const clients = makeClients();

    await runCleanup({
      config,
      command: { ...cleanupCommand, purge: true },
      clients,
      logger,
    });

    expect(clients.upload.scheduleFileDeletion).toHaveBeenCalledWith("file-2");
  });

  it("wraps removeFileSharing failures", async () => {
    const clients = makeClients();
    clients.upload.removeFileSharing.mockRejectedValueOnce(
      new Error("permission denied"),
    );

    await expect(
      runCleanup({ config, command: cleanupCommand, clients, logger }),
    ).rejects.toThrow(
      /removeFileSharing\(file-2 -> profile-user-1\) failed: permission denied/,
    );
  });

  it("surfaces scheduleFileDeletion failures", async () => {
    const clients = makeClients();
    clients.upload.scheduleFileDeletion.mockResolvedValueOnce({
      error: { detail: "cannot delete" },
    });

    await expect(
      runCleanup({
        config,
        command: { ...cleanupCommand, purge: true },
        clients,
        logger,
      }),
    ).rejects.toThrow(/scheduleFileDeletion\(file-2\) failed: cannot delete/);
  });
});
