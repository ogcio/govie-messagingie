import { httpErrors } from "@fastify/sensible";
import type { FastifyBaseLogger } from "fastify";
import type { Pool } from "pg";
import {
  CascadeConsentReasons,
  ConsentSubjects,
} from "~/schemas/consents/shared.js";
import type {
  PatchOrgProfileBody,
  PatchOrgProfileResponse,
} from "~/schemas/profiles/organisations.js";
import { getCurrentConsentStatement } from "~/services/consent-statements/consent-statements-service.js";
import { propagateConsentOnAccountLinking } from "~/services/consents/consents-service.js";
import { withClient } from "~/utils/with-client.js";
import { withRollback } from "~/utils/with-rollback.js";
import { getProfile } from "../get-profile.js";

export const organisationPatchProfile = async (params: {
  pool: Pool;
  profileIdToUpdate: string;
  payload: PatchOrgProfileBody;
  logger: FastifyBaseLogger;
}): Promise<PatchOrgProfileResponse> => {
  return withClient(params.pool, async (client) => {
    return withRollback(client, async (rollbackClient) => {
      const profileFromDb = await getProfile({
        client: rollbackClient,
        organizationId: undefined,
        profileId: params.profileIdToUpdate,
        addLinkedProfiles: true,
        consentSubjects: [],
      });
      if (!profileFromDb) {
        throw httpErrors.notFound("To update profile not found");
      }

      // if param.payload.primaryUserId is null,
      // the primaryUserId we should set is the profile's own id
      const toSetPrimaryUserId =
        params.payload.primaryUserId ?? profileFromDb.id;
      if (toSetPrimaryUserId === profileFromDb.primaryUserId) {
        params.logger.info(
          {
            toUpdateProfileId: params.profileIdToUpdate.substring(0, 5),
            toSetPrimaryUserId: toSetPrimaryUserId.substring(0, 5),
          },
          "No change in primaryUserId, skipping update",
        );
        // no change needed
        return {
          primaryUserId: profileFromDb.primaryUserId,
        };
      }

      if (
        profileFromDb.linkedProfiles &&
        profileFromDb.linkedProfiles.length > 0
      ) {
        throw httpErrors.badRequest(
          "Cannot update profile that has linked profiles",
        );
      }

      let needToCascadeConsent = false;
      // if param.payload.primaryUserId is not null,
      // we need to check that the user exists
      if (toSetPrimaryUserId !== profileFromDb.id) {
        const toSetAsParentProfile = await getProfile({
          client,
          organizationId: undefined,
          profileId: toSetPrimaryUserId,
          addLinkedProfiles: false,
          consentSubjects: [],
        });

        if (!toSetAsParentProfile) {
          throw httpErrors.notFound(
            "The primaryUserId to set does not correspond to any existing profile",
          );
        }
        if (toSetAsParentProfile.primaryUserId !== toSetAsParentProfile.id) {
          throw httpErrors.badRequest(
            "The primaryUserId to set corresponds to a profile that is not a primary profile",
          );
        }

        needToCascadeConsent = true;
      }

      const result = await client.query<{ primaryUserId: string }>(
        `
        UPDATE profiles
            SET primary_user_id = $1
        WHERE id = $2
        RETURNING primary_user_id as "primaryUserId"
      `,
        [toSetPrimaryUserId, params.profileIdToUpdate],
      );

      if (result.rowCount === 0) {
        throw httpErrors.internalServerError("Failed to update the profile");
      }

      if (needToCascadeConsent) {
        await propagateConsentOnAccountLinking({
          client,
          primaryProfileId: toSetPrimaryUserId,
          childProfileId: params.profileIdToUpdate,
          reason: CascadeConsentReasons.AccountLinking,
          currentConsentStatement: await getCurrentConsentStatement({
            client,
            subject: ConsentSubjects.Messaging,
          }),
          logger: params.logger,
        });
      }

      return {
        primaryUserId: result.rows[0].primaryUserId,
      };
    });
  });
};
