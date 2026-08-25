import type { Pool } from "pg";
import type { PaginationParams } from "~/schemas/pagination.js";
import type { ListProfilesSearchParams } from "~/schemas/profiles/list.js";
import type {
  ProfileWithDetails,
  ProfileWithDetailsFromDb,
} from "~/schemas/profiles/model.js";
import { mergeProfileDataWithProfiles } from "~/schemas/profiles/shared.js";
import { withClient } from "~/utils/with-client.js";
import { buildListProfilesQueries } from "./sql/build-list-profiles-queries.js";
import { selectProfileDataForProfileDetailIds } from "./sql/select-profile-data-for-profile-detail-ids.js";

export const listProfiles = async (params: {
  pool: Pool;
  organisationId: string | undefined;
  pagination: Required<PaginationParams>;
  searchParams?: Omit<ListProfilesSearchParams, "consentSubjects"> & {
    ppsns?: string[];
  };
  activeOnly?: boolean;
  consentSubjects: string[];
}): Promise<{ data: ProfileWithDetails[]; total: number }> =>
  withClient(params.pool, async (client) => {
    const queries = buildListProfilesQueries(params);
    const countResponse = await client.query<{ count: number }>(
      queries.count.query,
      queries.count.values,
    );

    if (
      countResponse.rows.length === 0 ||
      Number(countResponse.rows[0].count) === 0
    ) {
      return {
        data: [],
        total: 0,
      };
    }

    const profiles = await client.query<ProfileWithDetailsFromDb>(
      queries.data.query,
      queries.data.values,
    );

    const profileDataMap = await selectProfileDataForProfileDetailIds({
      client,
      profileDetailsIds: profiles.rows.map((row) => row.profileDetailsId),
    });

    const mergedProfiles = mergeProfileDataWithProfiles(
      profiles.rows,
      profileDataMap,
    );

    return {
      data: mergedProfiles,
      total: Number(countResponse.rows[0].count),
    };
  });
