import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import { Permissions } from "~/const/permissions.js";
import {
  type SupportSearchResponse,
  SupportSearchSchema,
} from "~/schemas/profiles/support.js";
import type {
  FastifyReplyTypebox,
  FastifyRequestTypebox,
} from "~/schemas/shared.js";
import { supportSearch } from "~/services/profiles/support.js";
import { formatAPIResponse, sanitizePagination } from "~/utils/pagination.js";
import { ensureValidSupportUser } from "~/utils/support-routes.js";

const plugin: FastifyPluginAsyncTypebox = async (fastify: FastifyInstance) => {
  const {
    pg: { pool },
    config,
  } = fastify;

  fastify.post(
    "/search",
    {
      preValidation: (req, res) =>
        fastify.checkPermissions(req, res, [Permissions.Platform.Read]),
      schema: SupportSearchSchema,
    },
    async (
      request: FastifyRequestTypebox<typeof SupportSearchSchema>,
      reply: FastifyReplyTypebox<typeof SupportSearchSchema>,
    ) => {
      const error = ensureValidSupportUser(request, reply);
      if (error) {
        return error;
      }

      const pagination = sanitizePagination(request.body);
      const supportSearchResult = await supportSearch({
        logger: request.log,
        pool,
        body: request.body,
        pagination,
      });

      return reply.send(
        formatAPIResponse<SupportSearchResponse[0]>({
          data: supportSearchResult.data,
          config,
          request,
          totalCount: supportSearchResult.total,
        }),
      );
    },
  );
};

export default plugin;
export const autoPrefix = "/api/v1/support/profiles";
