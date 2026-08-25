import { httpErrors } from "@fastify/sensible";
import type { PoolClient } from "pg";
import type { SavedFileInfo } from "~/utils/save-request-file.js";

export const createProfileImport = async (
  client: PoolClient,
  organisationId: string,
  source: "json" | "csv" = "csv",
  metadata?: SavedFileInfo["metadata"],
): Promise<{ jobToken: string; profileImportId: string }> => {
  const response = await client.query<{ id: string; job_token: string }>(
    "INSERT INTO profile_imports (organisation_id, source, metadata) VALUES ($1, $2, $3) RETURNING id, job_token;",
    [organisationId, source, metadata ? JSON.stringify(metadata) : "{}"],
  );

  const jobToken = response.rows[0]?.job_token;
  const profileImportId = response.rows[0]?.id;

  if (!profileImportId) {
    throw httpErrors.internalServerError("Cannot insert profile import!");
  }

  return { jobToken, profileImportId };
};
