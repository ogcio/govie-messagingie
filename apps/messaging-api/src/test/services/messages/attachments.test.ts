import type { FastifyBaseLogger } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSharedFilesForUser = vi.fn();
const getM2MUploadSdk = vi.fn(async () => ({ getSharedFilesForUser }));

vi.mock("../../../utils/authentication-factory.js", () => ({
  getM2MUploadSdk: (...args: unknown[]) => getM2MUploadSdk(...args),
}));

const { ensureUserCanAccessAttachments } = await import(
  "../../../services/messages/attachments.js"
);

const logger = { debug: vi.fn() } as unknown as FastifyBaseLogger;

const baseParams = {
  userProfileId: "profile-1",
  organizationId: "org-1",
  logger,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ensureUserCanAccessAttachments", () => {
  it("returns early without calling upload when there are no attachments", async () => {
    await ensureUserCanAccessAttachments({ ...baseParams, attachmentIds: [] });

    expect(getM2MUploadSdk).not.toHaveBeenCalled();
  });

  it("passes when every attachment is shared with the user", async () => {
    getSharedFilesForUser.mockResolvedValueOnce({
      data: [{ id: "file-1" }, { id: "file-2" }, {}],
    });

    await expect(
      ensureUserCanAccessAttachments({
        ...baseParams,
        attachmentIds: ["file-1", "file-2"],
      }),
    ).resolves.toBeUndefined();

    expect(getSharedFilesForUser).toHaveBeenCalledWith("profile-1", "org-1");
  });

  it("rejects attachments that are not shared with the user", async () => {
    getSharedFilesForUser.mockResolvedValueOnce({ data: [{ id: "file-1" }] });

    await expect(
      ensureUserCanAccessAttachments({
        ...baseParams,
        attachmentIds: ["file-1", "file-9"],
      }),
    ).rejects.toThrow(/attachment with id file-9 is not shared/);
  });

  it("maps upload errors to a 503 with detail", async () => {
    getSharedFilesForUser.mockResolvedValueOnce({
      error: { detail: "upstream down" },
    });

    await expect(
      ensureUserCanAccessAttachments({
        ...baseParams,
        attachmentIds: ["file-1"],
      }),
    ).rejects.toMatchObject({
      statusCode: 503,
      message: expect.stringContaining("upstream down"),
    });
  });

  it("maps a missing data payload to a 503", async () => {
    getSharedFilesForUser.mockResolvedValueOnce({ data: undefined });

    await expect(
      ensureUserCanAccessAttachments({
        ...baseParams,
        attachmentIds: ["file-1"],
      }),
    ).rejects.toMatchObject({ statusCode: 503 });
  });
});
