import { httpErrors } from "@fastify/sensible";
import type { FastifyBaseLogger } from "fastify";
import type { Pool } from "pg";
import {
  LifecycleTaskStatuses,
  LifecycleTaskTypes,
} from "~/schemas/data-lifecycle-tasks/index.js";
import { getCitizenUploadSdk } from "~/utils/authentication-factory.js";

const NOT_FOUND_ERROR_MESSAGE =
  "Export file not found or not ready for download";

export async function getUserExportFileId(params: {
  loggedInUserData: { userId: string; accessToken: string };
  taskId: string;
  taskProfileId: string;
  pool: Pool;
  logger: FastifyBaseLogger;
}) {
  const task = await getTaskFromDb(params);

  const uploadSdk = getCitizenUploadSdk({ userData: params.loggedInUserData });

  const fileMetadata = await uploadSdk.getFileMetadata(task.uploadId);

  if (fileMetadata.error || !fileMetadata.data) {
    params.logger.error(
      {
        taskId: params.taskId,
        uploadId: task.uploadId,
        error: fileMetadata.error,
        hasData: !!fileMetadata.data,
      },
      "Error retrieving file metadata from upload service",
    );

    throw httpErrors.badRequest(
      "Error retrieving file metadata from upload service",
    );
  }

  const expiresAt = fileMetadata.data?.expiresAt ?? undefined;
  ensureUploadIsNotExpired(expiresAt, params.logger);

  return { fileId: task.uploadId };
}

async function getTaskFromDb(params: {
  taskId: string;
  taskProfileId: string;
  pool: Pool;
  logger: FastifyBaseLogger;
}) {
  const exportType = LifecycleTaskTypes.ExportUserData;
  const succeededStatus = LifecycleTaskStatuses.Completed;

  const taskFromDb = await params.pool.query<{
    id: string;
    metadata: { uploadId?: string };
  }>(
    `
        SELECT id, metadata
        FROM data_lifecycle_tasks
        WHERE id = $1
        AND profile_id = $2
        AND task_type = $3
        AND status = $4
      `,
    [params.taskId, params.taskProfileId, exportType, succeededStatus],
  );
  const metadata = taskFromDb.rows.at(0)?.metadata;

  if (!metadata?.uploadId || metadata.uploadId.trim().length === 0) {
    params.logger.error(
      {
        taskId: params.taskId,
      },
      "Upload ID is missing in task metadata or is invalid",
    );

    throw httpErrors.notFound(NOT_FOUND_ERROR_MESSAGE);
  }

  return { id: taskFromDb.rows[0].id, uploadId: metadata.uploadId };
}

function ensureUploadIsNotExpired(
  expiresAt: string | undefined,
  logger: FastifyBaseLogger,
): void {
  const expiryDate = expiresAt ? new Date(expiresAt) : null;
  const now = new Date();

  if (!expiryDate || expiryDate > now) {
    return;
  }

  logger.error(
    {
      expiresAt,
    },
    "File upload has expired",
  );

  throw httpErrors.notFound(NOT_FOUND_ERROR_MESSAGE);
}
