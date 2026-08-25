import type { PoolClient } from "pg";

export const selectProfileDataForProfileDetailIds = async (params: {
  client: PoolClient;
  profileDetailsIds: string[];
}): Promise<
  Record<
    string,
    { firstName?: string; lastName?: string; ppsn?: string; email?: string }
  >
> => {
  const { client, profileDetailsIds } = params;
  const profilesData = await client.query<{
    profileDetailsId: string;
    name: string;
    value: string;
  }>(
    `
      SELECT
        pdata.profile_details_id as "profileDetailsId",
        pdata.name,
        pdata.value
    FROM profile_data pdata
    WHERE pdata.profile_details_id = ANY($1)
    AND pdata.value_type = 'string'
    AND pdata.name IN ('firstName', 'lastName', 'ppsn', 'email')
  `,
    [profileDetailsIds],
  );

  // Build a map from profileDetailsId to { firstName, lastName, ppsn }
  const profileDataMap: Record<
    string,
    { firstName?: string; lastName?: string; ppsn?: string; email?: string }
  > = {};
  for (const row of profilesData.rows) {
    if (!profileDataMap[row.profileDetailsId]) {
      profileDataMap[row.profileDetailsId] = {};
    }
    profileDataMap[row.profileDetailsId][
      row.name as "firstName" | "lastName" | "ppsn" | "email"
    ] = row.value;
  }

  return profileDataMap;
};
