import type { PoolClient } from "pg";
import { ProfileDetailsError } from "~/services/profiles/create-update-profile-details.js";

export const createProfileDetails = async (
  client: PoolClient,
  profileId: string,
  organizationId: string | undefined,
): Promise<string> => {
  const query = `INSERT INTO profile_details(
        profile_id,
        organisation_id,
        is_latest
    ) VALUES ($1, $2, $3) RETURNING id;`;

  const values = [profileId, organizationId, true];

  const result = await client.query<{ id: string }>(query, values);

  if (!result.rows[0]?.id) {
    throw new ProfileDetailsError(
      `Unable to insert profile detail with profile_id ${profileId} and organisation id ${organizationId}`,
    );
  }

  return result.rows[0].id;
};

export const createProfileDetailsBulk = async (
  client: PoolClient,
  profileIds: string[],
  organizationId: string | undefined,
): Promise<string[]> => {
  if (profileIds.length === 0) {
    return [];
  }

  const values = profileIds
    .map(
      (_, index) => `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3})`,
    )
    .join(",");
  const params = profileIds.flatMap((id) => [id, organizationId, true]);

  const query = `
    INSERT INTO profile_details(
      profile_id,
      organisation_id,
      is_latest
    ) VALUES ${values} RETURNING id;
  `;

  const result = await client.query<{ id: string }>(query, params);

  if (result.rows.length !== profileIds.length) {
    throw new ProfileDetailsError(
      `Unable to insert all profile details for organization id ${organizationId}`,
    );
  }

  return result.rows.map((row) => row.id);
};
