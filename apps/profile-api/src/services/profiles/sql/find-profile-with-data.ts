import type { PoolClient } from "pg";
import type { ProfileWithDetailsFromDb } from "~/schemas/profiles/model.js";

export const findProfileWithData = async (
  client: PoolClient,
  organizationId: string | undefined,
  profileId: string,
  consentSubjects: string[],
): Promise<ProfileWithDetailsFromDb | undefined> => {
  let organizationClause = " IS NULL ";
  const values: (string | string[] | null)[] = [profileId];
  let nextIndex = 2;
  if (organizationId !== undefined) {
    organizationClause = ` = $${nextIndex++} `;
    values.push(organizationId);
  }
  values.push(consentSubjects);
  const result = await client.query<ProfileWithDetailsFromDb>(
    `
        SELECT 
        p.id,
        p.public_name as "publicName",
        p.email,
        p.primary_user_id as "primaryUserId",
        p.created_at as "createdAt",
        p.updated_at as "updatedAt",
        p.preferred_language as "preferredLanguage",
        p.status,
        CASE
            WHEN array_length($${nextIndex}::text[], 1) IS NULL OR p.consent_statuses IS NULL THEN NULL
            ELSE (
              SELECT jsonb_object_agg(key, value)
              FROM jsonb_each(p.consent_statuses)
              WHERE key = ANY($${nextIndex}::text[])
            )
          END AS "consentStatuses",
        (
            SELECT jsonb_object_agg(pdata.name, 
            jsonb_build_object(
                'value', pdata.value,
                'type', pdata.value_type
            )
            )
            FROM profile_data pdata
            INNER JOIN profile_details pd ON pd.id = pdata.profile_details_id
            WHERE pd.profile_id = p.id 
            AND pd.organisation_id ${organizationClause}
            AND pd.is_latest = true
        ) as details
        FROM profiles p
        WHERE p.id = $1
        AND p.deleted_at IS NULL
        `,
    values,
  );

  return result.rows?.[0];
};

export const findProfilesWithDataBulk = async (
  client: PoolClient,
  organizationId: string | undefined,
  profileIds: string[],
): Promise<ProfileWithDetailsFromDb[]> => {
  if (profileIds.length === 0) {
    return [];
  }

  let organizationClause = " IS NULL ";
  const values = [...profileIds];
  if (organizationId !== undefined) {
    organizationClause = ` = $${profileIds.length + 1}`;
    values.push(organizationId);
  }

  const profilePlaceholders = profileIds.map((_, i) => `$${i + 1}`).join(",");

  const result = await client.query<ProfileWithDetailsFromDb>(
    `
        SELECT 
        p.id,
        p.public_name as "publicName",
        p.email,
        p.primary_user_id as "primaryUserId",
        p.created_at as "createdAt",
        p.updated_at as "updatedAt",
        p.preferred_language as "preferredLanguage",
        p.consent_statuses as "consentStatuses",
        (
            SELECT jsonb_object_agg(pdata.name, 
            jsonb_build_object(
                'value', pdata.value,
                'type', pdata.value_type
            )
            )
            FROM profile_data pdata
            INNER JOIN profile_details pd ON pd.id = pdata.profile_details_id
            WHERE pd.profile_id = p.id 
            AND pd.organisation_id ${organizationClause}
            AND pd.is_latest = true
        ) as details
        FROM profiles p
        WHERE p.id = ANY(ARRAY[${profilePlaceholders}])
        AND p.deleted_at IS NULL
        `,
    values,
  );

  return result.rows;
};
