import { httpErrors } from "@fastify/sensible";
import type { PoolClient } from "pg";

export const updateProfile = async ({
  client,
  profileId,
  publicName,
  email,
  preferredLanguage,
  primaryUserId,
}: {
  client: PoolClient;
  profileId: string;
  publicName: string;
  email: string;
  primaryUserId: string;
  preferredLanguage?: string;
}) => {
  const result = await client.query(
    `UPDATE profiles 
      SET public_name = $1, 
          email = $2,
          preferred_language = COALESCE($3, preferred_language),
          updated_at = $4,
          primary_user_id = $5
      WHERE id = $6 RETURNING id;`,
    [
      publicName,
      email,
      preferredLanguage,
      new Date(),
      primaryUserId,
      profileId,
    ],
  );
  if (result.rowCount === 0) {
    throw httpErrors.notFound("Profile does not exist");
  }
};
