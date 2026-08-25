import type { Pool } from "pg";
import type { KnownProfileDataDetails } from "~/schemas/profiles/model.js";
import { getProfileImportDetails as getProfileImportDetailsSQL } from "~/services/profiles/sql/get-profile-import-details.js";
import { withClient } from "~/utils/with-client.js";

export const getProfileImportDetails = async (
  pool: Pool,
  importId: string,
): Promise<KnownProfileDataDetails[]> =>
  withClient(pool, async (client) =>
    getProfileImportDetailsSQL(client, importId),
  );
