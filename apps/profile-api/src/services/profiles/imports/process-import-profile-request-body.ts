import type { Analytics } from "@ogcio/building-blocks-sdk/dist/types/index.js";
import type { FastifyInstance } from "fastify";
import { MimeTypes } from "~/const/mime-types.js";
import { Permissions } from "~/const/permissions.js";
import { privateDetailsRequested } from "~/routes/profiles/shared.js";
import {
  ImportProfilesImportTypesEnum,
  type ImportProfilesSchema,
} from "~/schemas/profiles/import-profiles.js";
import type {
  KnownProfileDataDetails,
  PpsnOnlyProfileDataDetails,
} from "~/schemas/profiles/model.js";
import type {
  FastifyReplyTypebox,
  FastifyRequestTypebox,
} from "~/schemas/shared.js";
import { getProfilesFromCsv } from "~/services/profiles/get-profiles-from-csv.js";
import { normalizeProfiles } from "~/services/profiles/normalize-profile.js";
import { PROFILE_IMPORT_EVENT_ACTIONS } from "~/services/tracking.js";
import { parseBooleanEnum } from "~/types/typebox.js";
import {
  ensureUserIdIsSet,
  getOrgAnalyticsSdk,
} from "~/utils/authentication-factory.js";
import { hasPermissions } from "~/utils/has-permissions.js";
import {
  type SavedFileInfo,
  saveRequestFile,
} from "~/utils/save-request-file.js";
import { withOrganizationId } from "~/utils/with-organization-id.js";

export async function processImportProfileRequestBody({
  fastify,
  request,
  reply,
}: {
  fastify: FastifyInstance;
  request: FastifyRequestTypebox<typeof ImportProfilesSchema>;
  reply: FastifyReplyTypebox<typeof ImportProfilesSchema>;
}): Promise<{
  analyticsSdk: Analytics;
  organisationId: string;
  profiles: KnownProfileDataDetails[];
  insertPrivateDetails: boolean;
  onlyPrivateDetails: boolean;
  immediateExecution: boolean;
  sourceType: "json" | "csv";
  fileMetadata: undefined | SavedFileInfo["metadata"];
}> {
  const organisationId = withOrganizationId(request);
  const analytics = await getOrgAnalyticsSdk(
    fastify.config,
    request.log,
    organisationId,
  );

  const isJson =
    request.headers["content-type"]?.startsWith(MimeTypes.Json) ?? false;
  let profiles: KnownProfileDataDetails[] | PpsnOnlyProfileDataDetails[] = [];
  let savedFile: SavedFileInfo | undefined;

  if (isJson) {
    profiles =
      request.query.importType === ImportProfilesImportTypesEnum.PpsnOnly
        ? (request.body.ppsnOnlyProfiles as PpsnOnlyProfileDataDetails[])
        : (request.body.profiles as KnownProfileDataDetails[]);
  } else {
    savedFile = await saveRequestFile(request);
    profiles = await getProfilesFromCsv(
      savedFile.filepath,
      request.query.importType,
    );
  }

  profiles = normalizeProfiles(profiles, request.query.importType);

  analytics.track.event({
    event: {
      ...PROFILE_IMPORT_EVENT_ACTIONS.IMPORT_PROFILES_READ_FILE,
      value: profiles.length,
    },
    contextOverride: {
      customDimensions: {
        organizationId: request.userData?.organizationId ?? null,
        source: isJson ? "JSON" : "CSV",
      },
    },
  });

  const insertPrivateDetails = await privateDetailsRequested({
    userData: {
      userId: ensureUserIdIsSet(request),
      organizationId: request.userData?.organizationId,
    },
    requestProfileId: undefined,
    queryPrivateDetails: request.query.privateDetails,
    queryOrganizationId: undefined,
    hasSuperAdminPermission: await hasPermissions({
      app: fastify,
      request,
      reply,
      permissions: [Permissions.UserAdmin.Write],
    }),
  });

  const onlyPrivateDetails =
    insertPrivateDetails &&
    parseBooleanEnum(request.query.onlyPrivateDetails ?? "false");

  return {
    analyticsSdk: analytics,
    organisationId,
    profiles,
    insertPrivateDetails,
    onlyPrivateDetails,
    immediateExecution: isJson,
    sourceType: isJson ? "json" : "csv",
    fileMetadata: savedFile?.metadata,
  };
}
