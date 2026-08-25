import { httpErrors } from "@fastify/sensible";
import type { FastifyBaseLogger } from "fastify";
import type { Pool, PoolClient } from "pg";
import type { LogtoClient } from "~/clients/logto.js";
import {
  CascadeConsentReasons,
  ConsentSubjects,
} from "~/schemas/consents/shared.js";
import type {
  ProfileWithDetails,
  ProfileWithDetailsFromDb,
} from "~/schemas/profiles/model.js";
import { parseProfileDetails } from "~/schemas/profiles/shared.js";
import type { PatchProfileBody } from "~/schemas/profiles/update.js";
import { withClient } from "~/utils/with-client.js";
import { withRollback } from "~/utils/with-rollback.js";
import { getCurrentConsentStatement } from "../consent-statements/consent-statements-service.js";
import { propagateConsentOnAccountLinking } from "../consents/consents-service.js";
import { createUpdateProfileDetails } from "./create-update-profile-details.js";
import { findProfileWithData } from "./sql/find-profile-with-data.js";
import { updateProfile as updateProfileSql } from "./sql/update-profile.js";

export const updateProfile = async (params: {
  pool: Pool;
  updateRequestedById: string;
  toUpdateProfileId: string;
  toSetProfileData: PatchProfileBody;
  organizationId?: string;
  logger: FastifyBaseLogger;
  getLogtoClient: () => Promise<LogtoClient>;
}): Promise<ProfileWithDetails> =>
  withClient(params.pool, async (client) =>
    withRollback(client, async (client) => {
      if (params.updateRequestedById === params.toUpdateProfileId) {
        const { primaryUserId, ...otherFields } = params.toSetProfileData;
        return updateMyProfile({
          toSetProfileData: otherFields,
          client,
          profileId: params.toUpdateProfileId,
          organizationId: params.organizationId,
        });
      }

      const { toUpdateProfile, primaryUserIdToSet } =
        await validateOtherProfileInputs({ ...params, client });

      return updateAnotherProfile({
        client,
        primaryUserIdToSet,
        toUpdateProfile,
        logger: params.logger,
      });
    }),
  );

async function validateOtherProfileInputs({
  updateRequestedById,
  toUpdateProfileId,
  toSetProfileData,
  organizationId,
  client,
  getLogtoClient,
}: {
  updateRequestedById: string;
  toUpdateProfileId: string;
  toSetProfileData: PatchProfileBody;
  organizationId?: string;
  client: PoolClient;
  getLogtoClient: () => Promise<LogtoClient>;
}): Promise<{
  toUpdateProfile: ProfileWithDetailsFromDb;
  primaryUserIdToSet: string;
}> {
  // user can only update generic data for another user
  if (organizationId) {
    throw httpErrors.badRequest(
      "Only generic data can be updated for another user, not organization related",
    );
  }

  const isPrimaryUserIdSetInRequest =
    toSetProfileData.primaryUserId !== undefined;
  const isAnotherFieldSetInRequest = Object.keys(toSetProfileData).some(
    (fieldName) => fieldName !== "primaryUserId",
  );

  // only primary_user_id can be set for another user
  if (!isPrimaryUserIdSetInRequest || isAnotherFieldSetInRequest) {
    throw httpErrors.badRequest(
      "For another user, only primary_user_id can be set",
    );
  }

  // updateRequestedBy must be equal to data.primary_user_id
  if (
    isPrimaryUserIdSetInRequest &&
    updateRequestedById !== toSetProfileData.primaryUserId
  ) {
    throw httpErrors.badRequest(
      "You can only set yourself as primary user id for another user",
    );
  }

  // asking for generic data
  const toUpdateProfileGeneric = await findProfileWithData(
    client,
    undefined,
    toUpdateProfileId,
    [],
  );

  if (!toUpdateProfileGeneric) {
    throw httpErrors.notFound("To update profile not found");
  }

  // if a profile has details when requesting for organization_id = undefined
  // means that it already logged in
  if (toUpdateProfileGeneric.details) {
    // We ensure it has already logged in invoking logto
    const logto = await getLogtoClient();
    const fromLogtoUser = await logto.getUser(toUpdateProfileId);
    if (
      fromLogtoUser.lastSignInAt !== null &&
      fromLogtoUser.lastSignInAt !== undefined
    ) {
      throw httpErrors.badRequest(
        "Cannot update data for a profile that already logged in",
      );
    }
  }

  // cannot update a profile that already has another primary_user_id
  if (
    isPrimaryUserIdSetInRequest &&
    toUpdateProfileGeneric.primaryUserId !== toUpdateProfileGeneric.id &&
    toSetProfileData.primaryUserId !== toUpdateProfileGeneric.primaryUserId
  ) {
    throw httpErrors.badRequest(
      "Can't update primary user id for this profile",
    );
  }

  const updateRequestedBy = await findProfileWithData(
    client,
    undefined,
    updateRequestedById,
    [],
  );
  if (!updateRequestedBy) {
    throw httpErrors.notFound("Primary profile not found");
  }

  if (updateRequestedBy.id !== updateRequestedBy.primaryUserId) {
    throw httpErrors.badRequest(
      "You can't use your profile as primary user because it's already linked to a parent",
    );
  }

  return {
    toUpdateProfile: toUpdateProfileGeneric,
    primaryUserIdToSet: toSetProfileData.primaryUserId as string,
  };
}

async function updateAnotherProfile({
  client,
  toUpdateProfile,
  primaryUserIdToSet,
  logger,
}: {
  client: PoolClient;
  primaryUserIdToSet: string;
  toUpdateProfile: ProfileWithDetailsFromDb;
  logger: FastifyBaseLogger;
}): Promise<ProfileWithDetails> {
  // we don't need to do anything, primary user id already matches
  if (primaryUserIdToSet === toUpdateProfile.primaryUserId) {
    return parseProfileDetails(toUpdateProfile);
  }

  await updateProfileSql({
    client,
    profileId: toUpdateProfile.id,
    publicName: toUpdateProfile.publicName,
    email: toUpdateProfile.email,
    primaryUserId: primaryUserIdToSet,
    preferredLanguage: toUpdateProfile.preferredLanguage,
  });

  const updatedProfile = await findProfileWithData(
    client,
    undefined,
    toUpdateProfile.id,
    [],
  );

  if (!updatedProfile) {
    throw httpErrors.notFound("Can't find profile after update");
  }

  await propagateConsentOnAccountLinking({
    client,
    primaryProfileId: primaryUserIdToSet,
    childProfileId: toUpdateProfile.id,
    reason: CascadeConsentReasons.AccountLinking,
    currentConsentStatement: await getCurrentConsentStatement({
      client,
      subject: ConsentSubjects.Messaging,
    }),
    logger,
  });

  return parseProfileDetails(updatedProfile);
}

async function updateMyProfile({
  client,
  toSetProfileData,
  organizationId,
  profileId,
}: {
  client: PoolClient;
  toSetProfileData: PatchProfileBody;
  organizationId: string | undefined;
  profileId: string;
}) {
  const existingProfile = await findProfileWithData(
    client,
    organizationId,
    profileId,
    [],
  );

  if (!existingProfile) {
    throw httpErrors.notFound(`Profile ${profileId} not found`);
  }

  // Please note: email address must not never be updated
  // in root profiles table, only in details
  const shouldUpdatePublicName =
    toSetProfileData.publicName &&
    toSetProfileData.publicName !== existingProfile.publicName;
  const shouldUpdateLanguage =
    toSetProfileData.preferredLanguage &&
    toSetProfileData.preferredLanguage !== existingProfile.preferredLanguage;
  const shouldUpdateProfile = shouldUpdatePublicName || shouldUpdateLanguage;

  if (shouldUpdateProfile) {
    // Update base profile fields if provided
    await updateProfileSql({
      client,
      profileId,
      publicName: toSetProfileData.publicName ?? existingProfile.publicName,
      email: existingProfile.email,
      preferredLanguage:
        toSetProfileData.preferredLanguage ?? existingProfile.preferredLanguage,
      primaryUserId: existingProfile.primaryUserId,
    });
  }

  // Create new profile details with updated data
  await createUpdateProfileDetails({
    client,
    organizationId,
    profileId,
    data: toSetProfileData,
    createOnly: false,
  });

  const updated = await findProfileWithData(
    client,
    organizationId,
    profileId,
    [],
  );

  if (!updated) {
    throw httpErrors.notFound(`Profile ${profileId} not found after update`);
  }

  return parseProfileDetails(updated);
}
