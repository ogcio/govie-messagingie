import type { Pool } from "pg";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildMockLogger } from "~/test/build-mock-logger.js";

const getFileMetadata = vi.fn();
vi.mock("~/utils/authentication-factory.js", () => ({
  getCitizenUploadSdk: vi.fn(() => ({ getFileMetadata })),
}));

import { getUserExportFileId } from "~/services/data-lifecycle-tasks/get-export-user-file-id.js";

const query = vi.fn();
const pool = { query } as unknown as Pool;
const { logger } = buildMockLogger({});

const params = {
  loggedInUserData: { userId: "user-1", accessToken: "token" },
  taskId: "task-1",
  taskProfileId: "profile-1",
  pool,
  logger,
};

const taskRow = (uploadId?: string) => ({
  rows: [{ id: "task-1", metadata: { uploadId } }],
});

describe("getUserExportFileId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the file id for a completed export with valid metadata", async () => {
    query.mockResolvedValue(taskRow("upload-1"));
    getFileMetadata.mockResolvedValue({
      data: { expiresAt: new Date(Date.now() + 60_000).toISOString() },
    });

    await expect(getUserExportFileId(params)).resolves.toEqual({
      fileId: "upload-1",
    });
    expect(getFileMetadata).toHaveBeenCalledWith("upload-1");
  });

  it("accepts metadata without an expiry", async () => {
    query.mockResolvedValue(taskRow("upload-1"));
    getFileMetadata.mockResolvedValue({ data: {} });

    await expect(getUserExportFileId(params)).resolves.toEqual({
      fileId: "upload-1",
    });
  });

  it("throws 404 when the task does not exist", async () => {
    query.mockResolvedValue({ rows: [] });

    await expect(getUserExportFileId(params)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("throws 404 when the upload id is missing or blank", async () => {
    query.mockResolvedValue(taskRow("   "));

    await expect(getUserExportFileId(params)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(getFileMetadata).not.toHaveBeenCalled();
  });

  it("throws 400 when the upload service reports an error", async () => {
    query.mockResolvedValue(taskRow("upload-1"));
    getFileMetadata.mockResolvedValue({ error: { detail: "nope" } });

    await expect(getUserExportFileId(params)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("throws 400 when the upload service returns no data", async () => {
    query.mockResolvedValue(taskRow("upload-1"));
    getFileMetadata.mockResolvedValue({});

    await expect(getUserExportFileId(params)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("throws 404 when the upload has expired", async () => {
    query.mockResolvedValue(taskRow("upload-1"));
    getFileMetadata.mockResolvedValue({
      data: { expiresAt: new Date(Date.now() - 60_000).toISOString() },
    });

    await expect(getUserExportFileId(params)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
