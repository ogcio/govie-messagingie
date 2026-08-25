import { httpErrors } from "@fastify/sensible";
import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import type { SeededOrganizationCustomData } from "~/clients/logto.js";
import { Permissions } from "~/const/permissions.js";
import { GetOrganisationSchema } from "~/schemas/organisations/index.js";
import type { FastifyRequestTypebox } from "~/schemas/shared.js";
import { getOrganizationMetadata } from "~/services/organisations/metadata.js";
import { getOrganisationTranslation } from "~/services/organisations/translations.js";
import { parseBooleanEnum } from "~/types/typebox.js";

const plugin: FastifyPluginAsyncTypebox = async (fastify: FastifyInstance) => {
  fastify.get(
    "/:organisationId",
    {
      // Citizens need this lookup to render sender names in the messaging
      // inbox, so the citizen-scoped UserSelf.Read is allowed alongside the
      // PSB-scoped permissions. UserOnboarding.Read mirrors the broad read
      // pattern used by `routes/profiles/index.ts` for the GET-by-id route.
      // The response is a localized display name and short name only - no
      // PII - so widening read access is safe (see schemas/organisations).
      preValidation: (req, res) =>
        fastify.checkPermissions(req, res, [
          Permissions.User.Read,
          Permissions.UserSelf.Read,
          Permissions.UserAdmin.Read,
          Permissions.UserOnboarding.Read,
        ]),
      schema: GetOrganisationSchema,
    },
    async (request: FastifyRequestTypebox<typeof GetOrganisationSchema>) => {
      const { organisationId } = request.params;
      const { includeCustomData } = request.query;

      try {
        // Get translations (unchanged function)
        const translationData = getOrganisationTranslation(organisationId);

        // Fetch organization metadata from Logto only if requested
        let metadata: SeededOrganizationCustomData | undefined;
        if (parseBooleanEnum(includeCustomData ?? "false")) {
          metadata = await getOrganizationMetadata(
            organisationId,
            fastify.config,
            request.log,
          );
        }

        return {
          data: {
            ...translationData,
            ...(includeCustomData && metadata ? { customData: metadata } : {}),
          },
        };
      } catch (error) {
        // Handle errors from getOrganisationTranslation (translation not found)
        if (error instanceof Error && error.message.includes("not found")) {
          throw httpErrors.notFound("Organisation not found");
        }
        // Re-throw if already an httpError (checking for statusCode property)
        if (
          typeof error === "object" &&
          error !== null &&
          "statusCode" in error &&
          typeof (error as { statusCode: unknown }).statusCode === "number"
        ) {
          throw error;
        }
        // Fallback for any other unexpected errors
        request.log.error({
          message: "Unexpected error in getOrganisation",
          error,
          organisationId,
        });
        throw httpErrors.internalServerError("Internal server error");
      }
    },
  );
};

export default plugin;
export const autoPrefix = "/api/v1/organisations";
