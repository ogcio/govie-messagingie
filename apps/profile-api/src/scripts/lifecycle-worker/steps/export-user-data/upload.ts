import { openAsBlob } from "node:fs";
import type { Upload } from "@ogcio/building-blocks-sdk/dist/types/index.js";
import type pino from "pino";

export async function uploadExportArchive(params: {
  uploadSupportSdk: Upload["support"];
  zipFilePath: string;
  zipFileName: string;
  expiresAt: string;
  profileId: string;
  logger: pino.Logger;
}): Promise<
  { uploadId: string; error?: never } | { uploadId?: never; error: Error }
> {
  const {
    uploadSupportSdk,
    zipFilePath,
    zipFileName,
    expiresAt,
    profileId,
    logger,
  } = params;

  logger.info(
    { zipFilePath, profileId },
    "[Export Data SDK] Opening blob for generated zip file to prepare for upload",
  );
  const zipBlob = await openAsBlob(zipFilePath, {
    type: "application/zip",
  });

  logger.info(
    { zipFilePath, profileId },
    "[Export Data SDK] Blob opened for zip file",
  );
  try {
    const upstreamResult = await uploadSupportSdk.uploadStreamFile(
      zipBlob,
      zipFileName,
      "application/zip",
      expiresAt,
    );

    const uploadId = upstreamResult.data?.uploadId;

    if (upstreamResult.error || !uploadId) {
      logger.error(
        {
          error: upstreamResult.error,
          profileId,
        },
        "Failed to upload export archive using Upload Support SDK",
      );
      return { error: new Error("Failed to upload generated export archive") };
    }

    logger.info(
      { uploadId, expiresAt, profileId },
      "Export archive uploaded successfully",
    );

    const shareResult = await uploadSupportSdk.shareFile(uploadId, profileId);
    if (shareResult.error) {
      logger.error(
        { error: shareResult.error, profileId },
        "Failed to share export archive using Upload Support SDK",
      );
      return { error: new Error("Failed to share generated export archive") };
    }

    logger.info(
      { uploadId, profileId },
      "Export archive shared successfully with user",
    );

    return { uploadId };
  } catch (error) {
    logger.error(
      { error, profileId },
      "Unexpected error occurred while uploading export archive",
    );
    return { error: error as Error };
  }
}
