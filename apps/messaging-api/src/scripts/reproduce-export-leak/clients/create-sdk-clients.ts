import { getBuildingBlockSDK, getM2MTokenFn } from "@ogcio/building-blocks-sdk";
import type { Messaging } from "@ogcio/building-blocks-sdk/dist/client/clients/messaging/index.js";
import type { Profile } from "@ogcio/building-blocks-sdk/dist/client/clients/profile/index.js";
import type { Upload } from "@ogcio/building-blocks-sdk/dist/client/clients/upload/index.js";
import type { LoadedConfig } from "../domain/types.js";

export type OrgSdkClients = {
  profile: Profile;
  messaging: Messaging;
  upload: Upload;
};

/**
 * Organisation-scoped SDK used by seed/cleanup. Mirrors the bulk-seeder auth
 * model: client-credentials ORG tokens per service with the minimal scopes
 * needed for uploadFile / shareFile / send / findProfile / removeFileSharing.
 */
export function createSdkClients(config: LoadedConfig): OrgSdkClients {
  const { endpoints, organizationId } = config;

  const sdk = getBuildingBlockSDK({
    services: {
      profile: { baseUrl: endpoints.profileBaseUrl },
      messaging: { baseUrl: endpoints.messagingBaseUrl },
      upload: { baseUrl: endpoints.uploadBaseUrl },
    },
    getTokenFn: getM2MTokenFn({
      services: {
        profile: {
          getOrganizationTokenParams: {
            logtoOidcEndpoint: endpoints.logtoOidcEndpoint,
            applicationId: config.profileM2M.applicationId,
            applicationSecret: config.profileM2M.applicationSecret,
            scopes: ["profile:user.admin:*"],
            organizationId,
          },
        },
        messaging: {
          getOrganizationTokenParams: {
            logtoOidcEndpoint: endpoints.logtoOidcEndpoint,
            applicationId: config.messagingM2M.applicationId,
            applicationSecret: config.messagingM2M.applicationSecret,
            scopes: ["messaging:message:*"],
            organizationId,
          },
        },
        upload: {
          getOrganizationTokenParams: {
            logtoOidcEndpoint: endpoints.logtoOidcEndpoint,
            applicationId: config.uploadM2M.applicationId,
            applicationSecret: config.uploadM2M.applicationSecret,
            scopes: ["upload:file:*"],
            organizationId,
          },
        },
      },
    }),
  });

  return {
    profile: sdk.profile,
    messaging: sdk.messaging,
    upload: sdk.upload,
  };
}
