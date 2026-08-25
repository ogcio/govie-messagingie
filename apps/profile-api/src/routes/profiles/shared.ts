import { httpErrors } from "@fastify/sensible";
import type { FastifyInstance } from "fastify";
import type { ImportProfilesSchema } from "~/schemas/profiles/import-profiles.js";
import type {
  FastifyReplyTypebox,
  FastifyRequestTypebox,
} from "~/schemas/shared.js";
import { scheduleImportProfiles } from "~/services/profiles/imports/import-profiles.js";
import { processImportProfileRequestBody } from "~/services/profiles/imports/process-import-profile-request-body.js";
import {
  type AcceptedQueryBooleanValues,
  parseBooleanEnum,
} from "~/types/typebox.js";

export async function privateDetailsRequested({
  userData,
  requestProfileId,
  queryPrivateDetails,
  queryOrganizationId,
  hasSuperAdminPermission,
}: {
  userData: { userId: string; organizationId: string | undefined };
  requestProfileId: string | undefined;
  queryOrganizationId?: string;
  queryPrivateDetails: AcceptedQueryBooleanValues | undefined;
  hasSuperAdminPermission: boolean;
}): Promise<boolean> {
  const needPrivateDetails = parseBooleanEnum(queryPrivateDetails ?? "false");

  if (needPrivateDetails && queryOrganizationId) {
    throw httpErrors.badRequest(
      "Cannot ask for private details and organization details at the same time",
    );
  }

  if (userData.organizationId && requestProfileId === userData.userId) {
    const psPrivateDetails =
      queryOrganizationId === undefined || needPrivateDetails;
    return psPrivateDetails;
  }

  if (!userData.organizationId) {
    const citizenPrivateDetails = queryOrganizationId === undefined;
    return citizenPrivateDetails;
  }

  if (!needPrivateDetails) {
    return false;
  }
  if (!hasSuperAdminPermission) {
    throw httpErrors.forbidden(
      "Admin access is needed to request private details",
    );
  }

  return true;
}

export async function importProfilesRoute(
  request: FastifyRequestTypebox<typeof ImportProfilesSchema>,
  reply: FastifyReplyTypebox<typeof ImportProfilesSchema>,
  fastify: FastifyInstance,
) {
  const {
    profiles,
    immediateExecution,
    fileMetadata,
    insertPrivateDetails,
    onlyPrivateDetails,
    sourceType,
    organisationId,
  } = await processImportProfileRequestBody({
    fastify,
    request,
    reply,
  });

  try {
    return await scheduleImportProfiles({
      pool: fastify.pg.pool,
      logger: request.log,
      organizationId: organisationId,
      config: fastify.config,
      profiles,
      source: sourceType,
      immediate: immediateExecution,
      fileMetadata: fileMetadata,
      insertPrivateDetails,
      onlyPrivateDetails,
    });
  } catch (error) {
    return reply.status(500).send({
      code: "INTERNAL_SERVER_ERROR",
      detail:
        error instanceof Error
          ? error.message
          : "There was a problem scheduling the import, please try again later",
      requestId: request.id,
      name: "InternalServerError",
      statusCode: 500,
    });
  }
}
