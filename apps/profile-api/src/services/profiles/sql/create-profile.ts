import { httpErrors } from "@fastify/sensible";
import type { PoolClient } from "pg";
import { DEFAULT_LANGUAGE, type Profile } from "~/schemas/profiles/model.js";

export const createProfile = async (
  client: PoolClient,
  profile: Omit<Profile, "status">,
): Promise<string> => {
  const query = `
    INSERT INTO profiles (
      id,
      public_name,
      email,
      primary_user_id,
      safe_level,
      preferred_language
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT(id) DO UPDATE SET
      public_name = EXCLUDED.public_name,
      email = EXCLUDED.email,
      safe_level = EXCLUDED.safe_level,
      preferred_language = EXCLUDED.preferred_language
    WHERE 
      profiles.public_name IS DISTINCT FROM EXCLUDED.public_name OR
      profiles.email IS DISTINCT FROM EXCLUDED.email OR
      profiles.safe_level IS DISTINCT FROM EXCLUDED.safe_level OR
      profiles.preferred_language IS DISTINCT FROM EXCLUDED.preferred_language
    RETURNING id;
  `;

  const values = [
    profile.id,
    profile.publicName,
    profile.email,
    profile.primaryUserId,
    profile.safeLevel ?? 0,
    profile.preferredLanguage ?? DEFAULT_LANGUAGE,
  ];

  const result = await client.query<{ id: string }>(query, values);
  if (!result.rows[0]?.id) {
    throw httpErrors.internalServerError("Cannot insert profile!");
  }

  return result.rows[0]?.id;
};
