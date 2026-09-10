import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Upload } from "@ogcio/building-blocks-sdk/dist/types/index.js";
import pino from "pino";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { uploadExportArchive } from "~/scripts/lifecycle-worker/steps/export-user-data/upload.js";

const dir = mkdtempSync(join(tmpdir(), "export-upload-"));
const zipFilePath = join(dir, "export.zip");
writeFileSync(zipFilePath, "zip-bytes");

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const uploadStreamFile = vi.fn();
const shareFile = vi.fn();
const uploadSupportSdk = {
  uploadStreamFile,
  shareFile,
} as unknown as Upload["support"];

const params = {
  uploadSupportSdk,
  zipFilePath,
  zipFileName: "export.zip",
  expiresAt: new Date(Date.now() + 1000 * 60).toISOString(),
  profileId: "profile-1",
  logger: pino({ enabled: false }),
};

describe("uploadExportArchive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadStreamFile.mockResolvedValue({ data: { uploadId: "up-1" } });
    shareFile.mockResolvedValue({ data: {} });
  });

  it("uploads and shares the archive", async () => {
    const result = await uploadExportArchive(params);

    expect(result).toEqual({ uploadId: "up-1" });
    expect(uploadStreamFile).toHaveBeenCalledWith(
      expect.any(Blob),
      "export.zip",
      "application/zip",
      params.expiresAt,
    );
    expect(shareFile).toHaveBeenCalledWith("up-1", "profile-1");
  });

  it("returns an error when the upload fails", async () => {
    uploadStreamFile.mockResolvedValue({ error: { detail: "quota" } });

    const result = await uploadExportArchive(params);

    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toContain("Failed to upload");
    expect(shareFile).not.toHaveBeenCalled();
  });

  it("returns an error when the upload succeeds without an uploadId", async () => {
    uploadStreamFile.mockResolvedValue({ data: {} });

    const result = await uploadExportArchive(params);

    expect(result.error?.message).toContain("Failed to upload");
  });

  it("returns an error when sharing fails", async () => {
    shareFile.mockResolvedValue({ error: { detail: "nope" } });

    const result = await uploadExportArchive(params);

    expect(result.error?.message).toContain("Failed to share");
  });

  it("returns the thrown error on unexpected failures", async () => {
    uploadStreamFile.mockRejectedValue(new Error("socket hang up"));

    const result = await uploadExportArchive(params);

    expect(result.error?.message).toBe("socket hang up");
  });
});
