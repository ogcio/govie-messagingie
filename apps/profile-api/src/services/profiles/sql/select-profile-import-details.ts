import { httpErrors } from "@fastify/sensible";
import type { PoolClient } from "pg";

export const selectProfileImportDetails = async (
  client: PoolClient,
  profileImportId: string,
): Promise<string[]> => {
  const { rows } = await client.query<{ id: string }>(
    `SELECT id FROM profile_import_details 
           WHERE profile_import_id = $1`,
    [profileImportId],
  );
  if (rows.length === 0) {
    throw httpErrors.notFound(
      `No import details found for import ID: ${profileImportId}`,
    );
  }

  return rows.map((row) => row.id);
};
