import type { FastifyInstance } from "fastify";
import Type from "typebox";
import { HttpError as OutputHttpError } from "../../types/httpErrors.js";
import { Permissions } from "../../types/permissions.js";
import {
  getGenericResponseSchema,
  ResponseMetadata,
} from "../../types/schemaDefinitions.js";
import { getOrganizationFiles, getSharedFiles } from "./utils/filesMetadata.js";

const API_DOCS_TAG = "SupportMetadata";

export default async function routes(app: FastifyInstance) {
  app.get<{ Querystring: { userId?: string; organizationId?: string } }>(
    "/",
    {
      preValidation: (req, res) =>
        app.checkPermissions(req, res, [Permissions.Platform.Read]),
      schema: {
        tags: [API_DOCS_TAG],
        querystring: Type.Object(
          {
            userId: Type.Optional(Type.String()),
            organizationId: Type.Optional(Type.String()),
          },
          { minProperties: 1 },
        ),
        response: {
          200: getGenericResponseSchema(Type.Array(ResponseMetadata)),
          "4xx": OutputHttpError,
          "5xx": OutputHttpError,
        },
      },
    },
    async (request) => {
      const isM2MApplication = request.userData?.isM2MApplication || false;
      if (!isM2MApplication) {
        throw app.httpErrors.forbidden(
          "You are not authorized to access this resource",
        );
      }

      const client = await app.pg.pool.connect();
      const queryUserId = request.query.userId;
      const queryOrganizationId = request.query.organizationId;

      try {
        if (queryOrganizationId) {
          const filesResponse = await getOrganizationFiles({
            client,
            organizationId: queryOrganizationId,
            toExclude: [],
          });
          return { data: filesResponse.rows };
        }

        if (queryUserId) {
          const sharedFiles = await getSharedFiles({
            client,
            userId: queryUserId,
            toExclude: [],
            organizationId: queryOrganizationId,
          });
          return { data: sharedFiles.rows };
        }

        throw app.httpErrors.badRequest(
          "At least one query paramater must be provided",
        );
      } catch (e) {
        throw app.httpErrors.createError(500, "Error getting files", {
          parent: e,
        });
      } finally {
        client.release();
      }
    },
  );
}
