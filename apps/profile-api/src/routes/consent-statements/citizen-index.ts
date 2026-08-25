import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import { Permissions } from "~/const/permissions.js";
import {
  CitizenCurrentConsentStatementSchema,
  CitizenGetConsentStatementSchema,
} from "~/schemas/consent-statements/citizen.js";
import type { FastifyRequestTypebox } from "~/schemas/shared.js";
import {
  getConsentStatementById,
  getCurrentConsentStatements,
} from "~/services/consent-statements/consent-statements-service.js";

const plugin: FastifyPluginAsyncTypebox = async (fastify: FastifyInstance) => {
  fastify.get(
    "/current",
    {
      preValidation: (req, res) =>
        fastify.checkPermissions(req, res, [Permissions.UserSelf.Read]),
      schema: CitizenCurrentConsentStatementSchema,
    },
    async (
      request: FastifyRequestTypebox<
        typeof CitizenCurrentConsentStatementSchema
      >,
    ) => {
      const inputSubjects =
        request.query.subject.trim().length > 0
          ? request.query.subject.trim().split(",")
          : [];

      const output = await getCurrentConsentStatements({
        pool: fastify.pg.pool,
        subjects: inputSubjects,
      });

      return { data: output };
    },
  );

  fastify.get(
    "/:id",
    {
      preValidation: (req, res) =>
        fastify.checkPermissions(req, res, [Permissions.UserSelf.Read]),
      schema: CitizenGetConsentStatementSchema,
    },
    async (
      request: FastifyRequestTypebox<typeof CitizenGetConsentStatementSchema>,
    ) => {
      return {
        data: await getConsentStatementById({
          id: request.params.id,
          pool: fastify.pg.pool,
        }),
      };
    },
  );
};

export default plugin;
export const autoPrefix = "/api/v1/citizens/consent-statements";
