import type { PoolClient } from "pg";

export const updateProfileDetailsToNonLatest = async (
  client: PoolClient,
  exceptProfileDetailId: string,
  organizationId: string | undefined,
  profileId: string,
): Promise<void> => {
  let organizationClause = " IS NULL ";
  const values = [exceptProfileDetailId, profileId];
  if (organizationId !== undefined) {
    organizationClause = "= $3 ";
    values.push(organizationId);
  }

  const query = `
    UPDATE profile_details 
      SET is_latest = false 
      WHERE id <> $1 
      AND profile_id = $2
      AND organisation_id ${organizationClause};
      `;

  await client.query(query, values);
};

export const updateProfileDetailsToLatestBulk = async (
  client: PoolClient,
  profileDetailIds: string[],
  organizationId: string | undefined,
  profileIds: string[],
): Promise<void> => {
  if (profileDetailIds.length === 0) {
    return;
  }

  let organizationClause = " IS NULL ";
  const values = [...profileDetailIds, ...profileIds];

  if (organizationId !== undefined) {
    organizationClause = `= $${values.length + 1} `;
    values.push(organizationId);
  }

  const profileDetailPlaceholders = profileDetailIds
    .map((_, i) => `$${i + 1}`)
    .join(",");
  const profilePlaceholders = profileIds
    .map((_, i) => `$${profileDetailIds.length + i + 1}`)
    .join(",");

  const query = `
    UPDATE profile_details 
      SET is_latest = false 
      WHERE id NOT IN (${profileDetailPlaceholders})
      AND profile_id IN (${profilePlaceholders})
      AND organisation_id ${organizationClause};
  `;

  await client.query(query, values);
};
