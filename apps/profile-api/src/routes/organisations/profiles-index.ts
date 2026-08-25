import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import { Permissions } from "~/const/permissions.js";
import { PatchOrgProfileSchema } from "~/schemas/profiles/organisations.js";
import type { FastifyRequestTypebox } from "~/schemas/shared.js";
import { organisationPatchProfile } from "~/services/profiles/organisations/patch-profile.js";

const plugin: FastifyPluginAsyncTypebox = async (fastify: FastifyInstance) => {
  fastify.patch(
    "/:profileId",
    {
      preValidation: (req, res) =>
        fastify.checkPermissions(req, res, [Permissions.Platform.Write]),
      schema: PatchOrgProfileSchema,
    },
    async (request: FastifyRequestTypebox<typeof PatchOrgProfileSchema>) => {
      const updatedProfile = await organisationPatchProfile({
        pool: fastify.pg.pool,
        profileIdToUpdate: request.params.profileId,
        payload: request.body,
        logger: fastify.log,
      });

      return { data: updatedProfile };
    },
  );
};

export default plugin;
export const autoPrefix = "/api/v1/organisations/profiles";
