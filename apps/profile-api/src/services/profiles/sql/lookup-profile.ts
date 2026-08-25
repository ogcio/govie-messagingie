import type { PoolClient } from "pg";

export const lookupProfile = async (
  client: PoolClient,
  email: string,
): Promise<{
  exists: boolean;
  profileId: string | undefined;
  profileDetailId: string | undefined;
}> => {
  const result = await client.query<{
    profile_id: string;
    profile_detail_id: string;
  }>(
    `
    WITH found_profile AS (
      -- First try direct email lookup (uses idx_profiles_email)
      SELECT id, created_at
      FROM profiles
      WHERE email ILIKE $1 AND deleted_at IS NULL
      UNION ALL
      -- Then try profile_data lookup (uses idx_profile_data_lookup)
      SELECT p.id, p.created_at
      FROM profile_data pd
      JOIN profile_details pdet ON pdet.id = pd.profile_details_id
      JOIN profiles p ON p.id = pdet.profile_id
      WHERE pd.value = $1 
      AND pd.value_type = 'string' 
      AND pd.name = 'email'
      AND p.deleted_at IS NULL
      AND LOWER(p.email) <> LOWER($1)
    )
    SELECT 
      fp.id as profile_id,
      pd.id as profile_detail_id
    FROM found_profile fp
    -- Use the index for latest profile details (idx_profile_details_latest)
    LEFT JOIN profile_details pd ON pd.profile_id = fp.id AND pd.is_latest = true
    ORDER BY fp.created_at DESC
    LIMIT 1;
    `,
    [email],
  );

  const row = result.rows[0];
  return {
    exists: Boolean(row?.profile_id),
    profileId: row?.profile_id,
    profileDetailId: row?.profile_detail_id,
  };
};

export const lookupProfilesBulk = async (
  client: PoolClient,
  emails: string[],
): Promise<
  Map<string, { exists: boolean; profileId?: string; profileDetailId?: string }>
> => {
  if (emails.length === 0) {
    return new Map();
  }

  const lowercasedEmails = emails.map((email) => email.toLowerCase());
  const placeholders = lowercasedEmails.map((_, i) => `$${i + 1}`).join(",");
  const result = await client.query<{
    email: string;
    profile_id: string;
    profile_detail_id: string;
  }>(
    `
    WITH found_profiles AS (
    -- Direct email lookup
    SELECT p.id, p.created_at, LOWER(p.email) as email
    FROM profiles p
    WHERE LOWER(p.email) = ANY(ARRAY[${placeholders}])
      AND p.deleted_at IS NULL

    UNION ALL

    -- Indirect email lookup via profile_data
    SELECT p.id, p.created_at, pd.value as email
    FROM profile_data pd
    JOIN profile_details pdet ON pdet.id = pd.profile_details_id
    JOIN profiles p ON p.id = pdet.profile_id
    WHERE LOWER(pd.value) = ANY(ARRAY[${placeholders}])
      AND pd.value_type = 'string'
      AND pd.name = 'email'
      AND p.deleted_at IS NULL
      AND LOWER(p.email) <> LOWER(pd.value)
      AND pdet.is_latest = true
      )
      SELECT 
          fp.email as email,
          fp.id as profile_id,
          pd.id as profile_detail_id
      FROM found_profiles fp
      LEFT JOIN profile_details pd 
            ON pd.profile_id = fp.id 
            AND pd.is_latest = true
      ORDER BY fp.created_at DESC;
    `,
    lowercasedEmails,
  );

  const profileMap = new Map<
    string,
    { exists: boolean; profileId?: string; profileDetailId?: string }
  >();
  for (const email of emails) {
    profileMap.set(email.toLowerCase(), { exists: false });
  }

  for (const row of result.rows) {
    profileMap.set(row.email.toLowerCase(), {
      exists: true,
      profileId: row.profile_id,
      profileDetailId: row.profile_detail_id,
    });
  }

  return profileMap;
};
