import type { PoolClient } from "pg";

export type DateOfBirthProfileDataRow = {
  id: string;
  value: string;
};

export const selectDateOfBirthProfileData = async (params: {
  client: PoolClient;
  limit: number;
  offset: number;
}): Promise<DateOfBirthProfileDataRow[]> => {
  const { client, limit, offset } = params;

  const { rows } = await client.query<DateOfBirthProfileDataRow>(
    `
    SELECT pd.id, pd.value
    FROM profile_data pd
    INNER JOIN profile_details pdet
      ON pdet.id = pd.profile_details_id
      AND pdet.is_latest = true
    WHERE pd.name = 'dateOfBirth'
    AND pd.value IS NOT NULL
    ORDER BY pd.id
    LIMIT $1 OFFSET $2
    `,
    [limit, offset],
  );

  return rows;
};

export const bulkUpdateProfileDataValues = async (params: {
  client: PoolClient;
  updates: Array<{ id: string; value: string }>;
}): Promise<void> => {
  const { client, updates } = params;

  if (updates.length === 0) {
    return;
  }

  const ids = updates.map((u) => u.id);
  const values = updates.map((u) => u.value);

  await client.query(
    `
    UPDATE profile_data AS pd
    SET value = u.value
    FROM (
      SELECT unnest($1::uuid[]) AS id, unnest($2::text[]) AS value
    ) AS u
    WHERE pd.id = u.id
    `,
    [ids, values],
  );
};
