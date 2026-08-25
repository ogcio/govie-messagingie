import type { FastifyBaseLogger } from "fastify";
import type { Pool, PoolClient } from "pg";
import type { LogtoClient } from "~/clients/logto.js";
import type {
  KnownProfileDataDetails,
  Profile,
} from "~/schemas/profiles/model.js";
import { DEFAULT_LANGUAGE } from "~/schemas/profiles/model.js";
import type { PatchProfileBody } from "~/schemas/profiles/update.js";
import { createUpdateProfileDetails } from "~/services/profiles/create-update-profile-details.js";
import { checkIfProfileExists } from "~/services/profiles/sql/check-if-profile-exists-by-id.js";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import { updateProfile } from "~/services/profiles/update-profile.js";
import type { ProfileCreationData } from "./types.js";
import type { WebhookUser } from "./webhook-body-to-user.js";

export const WebhookProfileService = {
  async findInterimUserByPpsn(client: PoolClient, ppsn: string) {
    const { rows: interimUsers } = await client.query(
      `SELECT p.id, p.primary_user_id
       FROM profiles p
       JOIN profile_details pd ON p.id = pd.profile_id
       JOIN profile_data pdata ON pd.id = pdata.profile_details_id
       WHERE pd.is_latest = true
       AND pdata.name = 'ppsn'
       AND pdata.value_type = 'string'
       AND pdata.value = $1
       AND p.primary_user_id = p.id
       AND p.deleted_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM profile_details 
         WHERE profile_id = p.id 
         AND organisation_id IS NULL
       )
       AND EXISTS (
         SELECT 1 FROM profile_details pd2
         JOIN profile_data pdata2 ON pd2.id = pdata2.profile_details_id
         WHERE pd2.profile_id = p.id
         AND pdata2.name = 'external_id'
         AND pdata2.value IS NOT NULL
         AND pdata2.value != ''
       )
       LIMIT 1`,
      [ppsn],
    );

    return interimUsers[0] || null;
  },

  async linkInterimUser(
    client: PoolClient,
    interimUserId: string,
    primaryUserId: string,
  ) {
    // Check if the profile is already linked to avoid unnecessary updates
    const { rows: existingLink } = await client.query(
      "SELECT primary_user_id FROM profiles WHERE id = $1",
      [interimUserId],
    );

    if (existingLink[0]?.primary_user_id === primaryUserId) {
      // Already linked to the correct primary user, no action needed
      return;
    }

    if (
      existingLink[0]?.primary_user_id &&
      existingLink[0].primary_user_id !== interimUserId
    ) {
      // Already linked to a different primary user - this could be an error
      throw new Error(
        `Profile ${interimUserId} is already linked to ${existingLink[0].primary_user_id}, cannot link to ${primaryUserId}`,
      );
    }

    await client.query(
      `UPDATE profiles 
       SET primary_user_id = $1, 
           updated_at = NOW() 
       WHERE id = $2 AND (primary_user_id = $2 OR primary_user_id IS NULL)`,
      [primaryUserId, interimUserId],
    );
  },

  async createProfileFromImportData(
    client: PoolClient,
    user: WebhookUser,
    importDetail: KnownProfileDataDetails,
    organizationId: string,
    insertPrivateDetails: boolean,
    onlyPrivateDetails: boolean,
  ) {
    const profileId = await createProfile(client, {
      id: user.id,
      email: user.email,
      publicName: [importDetail.firstName, importDetail.lastName].join(" "),
      primaryUserId: user.primaryUserId,
      safeLevel: 0,
    });

    if (!onlyPrivateDetails) {
      await createUpdateProfileDetails({
        client,
        organizationId,
        profileId,
        data: importDetail,
        createOnly: false,
      });
    }

    if (insertPrivateDetails) {
      await createUpdateProfileDetails({
        client,
        organizationId: undefined,
        profileId,
        data: importDetail,
        createOnly: true,
      });
    }

    return profileId;
  },

  async createOrUpdateProfileForDirectSignin(
    client: PoolClient,
    user: WebhookUser,
    pool: Pool,
    getLogtoClient: () => Promise<LogtoClient>,
    logger: FastifyBaseLogger,
  ) {
    const importDetail: KnownProfileDataDetails = {
      email: user.email,
      firstName: user.details?.firstName ?? "N/D",
      lastName: user.details?.lastName ?? "N/D",
      ppsn: user.details?.ppsn,
      dateOfBirth: user.details?.dateOfBirth,
      phone: user.details?.phone,
    };

    if (await checkIfProfileExists(client, user.id)) {
      const profileData: PatchProfileBody = {
        preferredLanguage: DEFAULT_LANGUAGE,
        ...importDetail,
      };

      await updateProfile({
        toUpdateProfileId: user.id,
        updateRequestedById: user.id,
        toSetProfileData: profileData,
        pool,
        getLogtoClient,
        logger,
      });

      return user.id;
    }

    let publicName = [
      user.details?.firstName ?? "",
      user.details?.lastName ?? "",
    ]
      .join(" ")
      .trim();

    if (publicName.length === 0) {
      publicName = user.email;
    }

    const profileDataToCreate: Omit<Profile, "status"> = {
      id: user.id,
      primaryUserId: user.primaryUserId,
      safeLevel: 0,
      email: user.email,
      publicName,
    };

    await createProfile(client, profileDataToCreate);
    await createUpdateProfileDetails({
      client,
      organizationId: undefined,
      profileId: user.id,
      data: importDetail,
      createOnly: false,
    });

    return user.id;
  },

  buildProfileCreationData(
    user: WebhookUser,
    importDetail: KnownProfileDataDetails,
  ): ProfileCreationData {
    return {
      id: user.id,
      email: user.email,
      publicName: [importDetail.firstName, importDetail.lastName].join(" "),
      primaryUserId: user.primaryUserId,
      safeLevel: 0,
    };
  },
};
