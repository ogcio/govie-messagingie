import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import { Permissions } from "~/const/permissions.js";
import { GetProfileImportDetailsSchema } from "~/schemas/profiles/get-import.js";
import { GetProfileTemplateSchema } from "~/schemas/profiles/get-template.js";
import { ImportProfilesSchema } from "~/schemas/profiles/import-profiles.js";
import { ListProfileImportsSchema } from "~/schemas/profiles/list-imports.js";
import type {
  FastifyReplyTypebox,
  FastifyRequestTypebox,
} from "~/schemas/shared.js";
import { getProfileImport } from "~/services/profiles/get-profile-import.js";
import { getProfileTemplate } from "~/services/profiles/get-profile-template.js";
import { getProfileImportDetails } from "~/services/profiles/imports/get-profile-import-details.js";
import { listProfileImports } from "~/services/profiles/imports/list-profile-imports.js";
import { formatAPIResponse, sanitizePagination } from "~/utils/pagination.js";
import { withOrganizationId } from "~/utils/with-organization-id.js";
import { importProfilesRoute } from "../shared.js";

const plugin: FastifyPluginAsyncTypebox = async (fastify: FastifyInstance) => {
  const {
    pg: { pool },
    config,
  } = fastify;

  fastify.post(
    "/",
    {
      preValidation: (req, res) =>
        fastify.checkPermissions(req, res, [
          Permissions.User.Write,
          Permissions.UserAdmin.Write,
        ]),
      schema: ImportProfilesSchema,
    },
    async (
      request: FastifyRequestTypebox<typeof ImportProfilesSchema>,
      reply: FastifyReplyTypebox<typeof ImportProfilesSchema>,
    ) => {
      return importProfilesRoute(request, reply, fastify);
    },
  );

  fastify.get(
    "/",
    {
      preValidation: (req, res) =>
        fastify.checkPermissions(req, res, [
          Permissions.User.Read,
          Permissions.UserAdmin.Read,
        ]),
      schema: ListProfileImportsSchema,
    },
    async (request: FastifyRequestTypebox<typeof ListProfileImportsSchema>) => {
      const { data, total: totalCount } = await listProfileImports({
        pool,
        organisationId: withOrganizationId(request),
        pagination: sanitizePagination(request.query),
        search: request.query.search,
        source: request.query.source,
      });

      return formatAPIResponse({
        data,
        config,
        request,
        totalCount,
      });
    },
  );

  fastify.get(
    "/:importId",
    {
      preValidation: (req, res) =>
        fastify.checkPermissions(req, res, [
          Permissions.User.Read,
          Permissions.UserAdmin.Read,
        ]),
      schema: GetProfileImportDetailsSchema,
    },
    async (
      request: FastifyRequestTypebox<typeof GetProfileImportDetailsSchema>,
    ) => {
      const [importData, importDetailsData] = await Promise.all([
        getProfileImport({ pool, profileImportId: request.params.importId }),
        getProfileImportDetails(pool, request.params.importId),
      ]);

      return {
        data: {
          ...importData,
          details: importDetailsData,
        },
      };
    },
  );

  fastify.get(
    "/template",
    {
      schema: GetProfileTemplateSchema,
      preValidation: (req, res) =>
        fastify.checkPermissions(req, res, [
          Permissions.User.Write,
          Permissions.UserAdmin.Write,
        ]),
    },
    async (_, reply) => {
      const csvBuffer = getProfileTemplate();
      return reply
        .header("Content-Type", "text/csv")
        .header(
          "Content-Disposition",
          'attachment; filename="profile-template.csv"',
        )
        .send(csvBuffer);
    },
  );
};

export default plugin;
export const autoPrefix = "/api/v1/profiles/imports";
