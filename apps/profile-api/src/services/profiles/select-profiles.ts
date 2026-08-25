import type { Pool } from "pg";
import type { ProfileWithDetails } from "~/schemas/profiles/model.js";
import { withClient } from "~/utils/with-client.js";
import { selectProfilesWithData } from "./sql/select-profiles-with-data.js";

export const selectProfiles = async (params: {
  pool: Pool;
  organizationId: string;
  profileIds: string[];
  consentSubjects: string[];
}): Promise<Partial<ProfileWithDetails>[]> =>
  withClient(params.pool, async (client) =>
    selectProfilesWithData(
      client,
      params.organizationId,
      params.profileIds,
      params.consentSubjects,
    ),
  );
