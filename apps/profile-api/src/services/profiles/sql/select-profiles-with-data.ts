import type { PoolClient } from "pg";
import type {
  ProfileWithDetails,
  ProfileWithDetailsFromDb,
} from "~/schemas/profiles/model.js";
import { mergeProfileDataWithProfiles } from "~/schemas/profiles/shared.js";
import { selectProfileDataForProfileDetailIds } from "./select-profile-data-for-profile-detail-ids.js";

export const selectProfilesWithData = async (
  client: PoolClient,
  organizationId: string,
  profileIds: string[],
  consentSubjects: string[],
): Promise<Partial<ProfileWithDetails>[]> => {
  const profiles = await client.query<ProfileWithDetailsFromDb>(
    `
      SELECT 
        p.id,
        p.public_name as "publicName",
        p.email,
        p.primary_user_id as "primaryUserId",
        p.created_at as "createdAt",
        p.updated_at as "updatedAt",
        p.preferred_language as "preferredLanguage",
        pd.id as "profileDetailsId",
        p.status,
        CASE
            WHEN array_length($3::text[], 1) IS NULL OR p.consent_statuses IS NULL THEN NULL
            ELSE (
              SELECT jsonb_object_agg(key, value)
              FROM jsonb_each(p.consent_statuses)
              WHERE key = ANY($3::text[])
            )
        END AS "consentStatuses"
      FROM profiles p
      INNER JOIN profile_details pd ON pd.profile_id = p.id
      WHERE p.id = ANY($2)
      AND pd.organisation_id = $1
      -- added is latest otherwise we might get multiple rows per profile
      AND pd.is_latest = true
      AND p.deleted_at IS NULL
      ORDER BY p.created_at DESC
      `,
    [organizationId, profileIds, consentSubjects],
  );

  const profileDataMap = await selectProfileDataForProfileDetailIds({
    client,
    profileDetailsIds: profiles.rows.map((row) => row.profileDetailsId),
  });

  return mergeProfileDataWithProfiles(profiles.rows, profileDataMap);
};
