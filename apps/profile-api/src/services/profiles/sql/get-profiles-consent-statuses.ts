import type { PoolClient } from "pg";

export async function selectProfileIdsWithNotSetConsentStatuses(
  profileIds: string[],
  client: PoolClient,
): Promise<{ id: string; primaryUserId: string }[]> {
  const result = await client.query<{ id: string; primaryUserId: string }>(
    `
        SELECT id, primary_user_id as "primaryUserId"
        FROM profiles
        WHERE id = ANY($1::text[]) and consent_statuses is null
    `,
    [profileIds],
  );

  return result.rows;
}
