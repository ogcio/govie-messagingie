import { type HttpError, httpErrors } from "@fastify/sensible";
import type { PoolClient } from "pg";
import type { KnownProfileDataDetails } from "~/schemas/profiles/model.js";

export class ProfileImportDetailNotFoundError implements HttpError {
  status = 404;
  statusCode = 404;
  expose = true;
  name = "ProfileImportDetailNotFound";
  message = "profile import detail not found";

  constructor(message?: string) {
    this.name = message ?? this.name;
  }
}

export const getProfileImportDetailDataByEmail = async (
  client: PoolClient,
  profileImportId: string,
  email: string,
): Promise<KnownProfileDataDetails> => {
  if (!profileImportId) {
    throw httpErrors.badRequest("Profile import ID is required");
  }
  if (!email) {
    throw httpErrors.badRequest("Email is required");
  }

  const result = await client.query<{ profile: KnownProfileDataDetails }>(
    `
    SELECT data as profile
    FROM profile_import_details
    WHERE profile_import_id = $1 
    AND data->>'email' = $2 
    AND data IS NOT NULL
    LIMIT 1;`,
    [profileImportId, email],
  );

  const profile = result.rows[0]?.profile;
  if (!profile) {
    throw new ProfileImportDetailNotFoundError(
      `No import detail found for email: ${email} in import: ${profileImportId}`,
    );
  }

  return profile;
};
