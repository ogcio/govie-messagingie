import type { Upload } from "@ogcio/building-blocks-sdk/dist/types/index.js";
import type { ZipArchive } from "archiver";
import type pino from "pino";
import { extractBoundary, logZipSize } from "./utils.js";
import { appendMultipartStreamToZip } from "./zip.js";

const FILES_CHUNK_SIZE = 5;

export async function getSharedFileIdsForUsers(params: {
  userIds: string[];
  uploadSupportSdk: Upload["support"];
  logger: pino.Logger;
}): Promise<
  | {
      success: true;
      fileIdsByUserId: Record<string, string[]>;
    }
  | { success: false; error: Error }
> {
  const { userIds, uploadSupportSdk, logger } = params;
  const promises: Promise<{
    userId: string;
    error?: Error;
    fileIds?: string[];
    emptyResponse?: true;
  }>[] = userIds.map(async (userId) => {
    const files = await uploadSupportSdk.getSharedFilesForUser({ userId });
    if (files.error || !files.data) {
      logger.error(
        { error: files.error },
        `Failed to get shared files for user ${userId}`,
      );
      return {
        userId,
        error: new Error(`Failed to get shared files for user ${userId}`),
      };
    }

    const fileIds = files.data
      .map((file: { id?: string }) => file.id)
      .filter((id: string | undefined): id is string => !!id);

    if (fileIds.length === 0) {
      logger.info(
        `[Export Data SDK] No files found for user ${userId}, skipping export`,
      );
      return { userId, emptyResponse: true as const };
    }

    return { userId, fileIds };
  });

  const results = await Promise.all(promises);
  const fileIdsByUserId: Record<string, string[]> = {};

  for (const result of results) {
    if ("error" in result && result.error) {
      logger.error(
        { error: result.error },
        `Error fetching shared files for user ${result.userId}`,
      );
      return { success: false as const, error: result.error };
    }

    if (!result.emptyResponse && result.fileIds) {
      fileIdsByUserId[result.userId] = result.fileIds;
    }
  }

  return { success: true as const, fileIdsByUserId };
}
export async function downloadAndZipFiles(params: {
  fileIdsByUserId: Record<string, string[]>;
  uploadSupportSdk: Upload["support"];
  zip: ZipArchive;
  logger: pino.Logger;
}): Promise<{ success: true } | { success: false; error: Error }> {
  const { fileIdsByUserId, uploadSupportSdk, zip, logger } = params;

  let isFirstDownload = true;
  let sleepFor = 400;
  const totalNumberOfFiles = Object.values(fileIdsByUserId).reduce(
    (sum, fileIds) => sum + fileIds.length,
    0,
  );
  logger.info(
    { totalNumberOfFiles },
    `[Export Data SDK] Starting download files`,
  );
  for (const [userId, fileIds] of Object.entries(fileIdsByUserId)) {
    const numberOfFiles = fileIds.length;
    logger.info(
      { userId, numberOfFiles },
      `[Export Data SDK] Downloading files for user`,
    );
    const chunks: string[][] = [];
    for (let i = 0; i < fileIds.length; i += FILES_CHUNK_SIZE) {
      chunks.push(fileIds.slice(i, i + FILES_CHUNK_SIZE));
    }
    let downloading = 0;
    for (const chunk of chunks) {
      downloading++;
      logger.info(
        { userId, downloading: `${downloading}/${chunks.length}` },
        `[Export Data SDK] Downloading chunk of files for user`,
      );
      if (!isFirstDownload) {
        // Add a small delay between downloads to avoid overwhelming the upload support service
        logger.info(
          { userId, sleepFor },
          "[Export Data SDK] Waiting before downloading next chunk of files",
        );
        await new Promise((resolve) => setTimeout(resolve, sleepFor));
        sleepFor = Math.min(sleepFor * 2, 10000); // Exponential backoff with a max of 10 seconds
      }
      isFirstDownload = false;
      const downloadResponse = await uploadSupportSdk.getFiles({
        fileIds: chunk,
        userId,
      });

      logger.info(
        { userId, downloaded: `${downloading}/${chunks.length}` },
        `[Export Data SDK] Downloaded chunk of files for user`,
      );

      if (downloadResponse.error || downloadResponse.status !== 200) {
        logger.error(
          { error: downloadResponse.error, status: downloadResponse.status },
          `[Export Data SDK] Failed to download files for user ${userId}`,
        );
        return {
          success: false,
          error: new Error(`Failed to download files for user ${userId}`),
        };
      }

      const contentType = downloadResponse.headers?.["content-type"] ?? "";
      const boundary = extractBoundary(contentType);
      if (!boundary) {
        logger.error(
          { contentType },
          "[Export Data SDK] Missing or invalid multipart boundary in response",
        );
        return {
          success: false,
          error: new Error(
            `Missing multipart boundary in content-type: ${contentType}`,
          ),
        };
      }

      logger.info(
        { userId, chunkSize: chunk.length },
        `[Export Data SDK] Appending chunk of files to zip for user`,
      );

      await appendMultipartStreamToZip({
        userId,
        chunk: { data: downloadResponse.data, boundary },
        zip,
        logger,
      });

      logZipSize({
        zip,
        logger,
        logParams: { stage: "after_appending_multipart", userId },
      });
    }
    logger.info(
      { userId, numberOfFiles },
      `[Export Data SDK] Finished downloading files for user`,
    );
  }

  return { success: true };
}
