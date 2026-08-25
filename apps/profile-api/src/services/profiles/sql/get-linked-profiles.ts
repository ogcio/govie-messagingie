import type { PoolClient } from "pg";
import type { LinkedProfile } from "~/schemas/profiles/model.js";

export const getLinkedProfiles = async (params: {
  client: PoolClient;
  primaryUserId: string;
}): Promise<LinkedProfile[]> => {
  const result = await params.client.query<LinkedProfile>(
    `
      SELECT 
        p.id,
        p.public_name as "publicName",
        p.email
      FROM profiles p
      WHERE p.primary_user_id = $1
      AND p.id != $1
      AND p.deleted_at IS NULL
    `,
    [params.primaryUserId],
  );

  return result.rows;
};
