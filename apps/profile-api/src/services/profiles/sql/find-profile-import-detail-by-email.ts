import { httpErrors } from "@fastify/sensible";
import type { PoolClient } from "pg";

export const findProfileImportDetailByEmail = async (
  client: PoolClient,
  profileImportId: string,
  email: string,
): Promise<string> => {
  const { rows } = await client.query<{ id: string }>(
    `SELECT id FROM profile_import_details 
           WHERE profile_import_id = $1 AND data->>'email' = $2`,
    [profileImportId, email],
  );
  if (rows.length === 0) {
    throw httpErrors.notFound(`No import details found for email: ${email}`);
  }

  return rows[0].id;
};
