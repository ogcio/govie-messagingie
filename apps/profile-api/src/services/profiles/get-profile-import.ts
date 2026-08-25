import type { Pool } from "pg";
import type { SavedFileInfo } from "~/utils/save-request-file.js";
import { withClient } from "~/utils/with-client.js";
import { getProfileImport as getProfileImportSql } from "./sql/get-profile-import.js";

export const getProfileImport = async (params: {
  pool: Pool;
  profileImportId: string;
}): Promise<{
  organisationId: string;
  metadata: SavedFileInfo["metadata"];
  status: string;
  createdAt: string;
}> => {
  return withClient(params.pool, async (client) => {
    return await getProfileImportSql(client, params.profileImportId);
  });
};
