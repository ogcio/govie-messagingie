import type { FastifyInstance } from "fastify";
import { Type } from "typebox";
import { HttpError as OutputHttpError } from "../../types/httpErrors.js";
import { Permissions } from "../../types/permissions.js";
import { getGenericResponseSchema } from "../../types/schemaDefinitions.js";
import { userCanAccessMultipleFilesOrThrow } from "../utils/userCanAccessMultipleFilesOrThrow.js";
import downloadMultipleFiles from "./utils/downloadMultipleFiles.js";
import { getUploadLimit } from "./utils/getUploadLimit.js";
import { processUpload } from "./utils/scanAndUpload.js";

const API_DOCS_TAG = "SupportFiles";

export default async function routes(app: FastifyInstance) {
  const uploadLimitPerIpPerMinute = getUploadLimit(app.config);
  app.post(
    "/",
    {
      config: {
        rateLimit: { max: uploadLimitPerIpPerMinute, timeWindow: "1 minute" },
      },
      preValidation: (req, res) =>
        app.checkPermissions(req, res, [Permissions.Platform.Write]),
      schema: {
        consumes: ["multipart/form-data"],
        body: Type.Union([Type.Any(), Type.Unknown()]),
        tags: [API_DOCS_TAG],
        response: {
          201: getGenericResponseSchema(Type.Object({ id: Type.String() })),
          "4xx": OutputHttpError,
          "5xx": OutputHttpError,
        },
      },
    },
    async (request, reply) => {
      if (!request.userData?.isM2MApplication) {
        throw app.httpErrors.forbidden(
          "You are not authorized to access this resource",
        );
      }

      request.log.info("starting scan and upload file");
      // We need bytes limit, so convert from MB to bytes
      const maxFileSize = Number.isNaN(app.config.MAX_SUPPORT_FILE_SIZE_MB)
        ? undefined
        : Number(app.config.MAX_SUPPORT_FILE_SIZE_MB) * 1024 * 1024;
      const fileId = await processUpload(app, request, {
        scan: false,
        customMaxFileSize: maxFileSize,
      });
      request.log.info("finished scan and upload file");

      reply.status(201);
      reply.send({ data: { id: fileId } });
    },
  );

  app.post<{ Body: { fileIds: string[]; userId: string } }>(
    "/download-batch",
    {
      preValidation: (req, res) =>
        app.checkPermissions(req, res, [Permissions.Platform.Read]),
      schema: {
        tags: [API_DOCS_TAG],
        body: Type.Object({
          fileIds: Type.Array(Type.String(), { minItems: 1, maxItems: 20 }),
          userId: Type.String(),
        }),
        response: {
          200: {
            description: "Multipart mixed response containing requested files",
            content: {
              "multipart/mixed": {
                schema: { type: "string", format: "binary" },
              },
            },
          },
          "4xx": OutputHttpError,
          "5xx": OutputHttpError,
        },
      },
    },
    async (request, reply) => {
      if (!request.userData?.isM2MApplication) {
        throw app.httpErrors.forbidden(
          "You are not authorized to access this resource",
        );
      }
      const { fileIds, userId } = request.body;

      request.log.info({ fileIds, userId }, "begin: download-batch");
      if (!request.userData) {
        throw app.httpErrors.forbidden("User data not found");
      }

      await userCanAccessMultipleFilesOrThrow({
        pg: app.pg,
        userData: request.userData,
        logger: request.log,
        fileIds,
        userToCheck: userId,
      });

      try {
        const { stream, boundary } = await downloadMultipleFiles({
          fileIds,
          s3Client: app.s3Client.client,
          bucketName: app.s3Client.bucketName,
          avClient: app.avClient,
          nodeCache: app.nodeCache,
          pg: app.pg,
          logger: request.log,
        });

        reply.header("Content-Type", `multipart/mixed; boundary=${boundary}`);

        request.log.info(
          { fileIds, userId: request.userData?.userId },
          "end: download-batch",
        );

        return reply.send(stream);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Error downloading files";

        if (message.includes("not found")) {
          throw app.httpErrors.notFound(message);
        }
        if (message.includes("infected")) {
          throw app.httpErrors.badRequest(message);
        }

        request.log.error(err, "error on download-batch");
        throw app.httpErrors.internalServerError("Error downloading files");
      }
    },
  );
}
