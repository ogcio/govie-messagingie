import { httpErrors } from "@fastify/sensible";
import type { PoolClient } from "pg";
import type { ImportStatus } from "~/const/profile.js";

export const getProfileImportStatus = async (
  client: PoolClient,
  id: string,
): Promise<ImportStatus> => {
  const result = await client.query<{ status: string }>(
    "SELECT status FROM profile_imports WHERE id = $1 LIMIT 1;",
    [id],
  );

  if (!result.rows[0]?.status) {
    throw httpErrors.notFound(
      `Status for profile_import with id ${id} not found`,
    );
  }

  return result.rows[0].status as ImportStatus;
};
