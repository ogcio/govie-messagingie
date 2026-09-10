import { httpErrors } from "@fastify/sensible";
import type { PoolClient } from "pg";
import type { SavedFileInfo } from "~/utils/save-request-file.js";

export const getProfileImport = async (
  client: PoolClient,
  id: string,
  organisationId?: string,
): Promise<{
  organisationId: string;
  metadata: SavedFileInfo["metadata"];
  status: string;
  createdAt: string;
}> => {
  const params: string[] = [id];
  let organisationFilter = "";
  if (organisationId !== undefined) {
    params.push(organisationId);
    organisationFilter = "AND organisation_id = $2";
  }

  const result = await client.query<{
    organisation_id: string;
    metadata: SavedFileInfo["metadata"];
    status: string;
    created_at: string;
  }>(
    `SELECT organisation_id, metadata, status, created_at
     FROM profile_imports
     WHERE id = $1 ${organisationFilter}
     LIMIT 1;`,
    params,
  );

  if (!result.rows[0]?.metadata) {
    throw httpErrors.notFound(
      `Status for profile_import with id ${id} not found`,
    );
  }

  return {
    organisationId: result.rows[0].organisation_id,
    metadata: result.rows[0].metadata,
    status: result.rows[0].status,
    createdAt: result.rows[0].created_at,
  };
};
