import type { Pool } from "pg";
import { getProfile } from "~/services/profiles/get-profile.js";

export function getProfileIdsToExport(params: {
  profileId: string;
  linkedProfiles: Array<{ id: string }> | undefined;
}): string[] {
  const { profileId, linkedProfiles } = params;
  return Array.from(
    new Set([
      profileId,
      ...(linkedProfiles?.map((linkedProfile) => linkedProfile.id) ?? []),
    ]),
  );
}

export async function loadProfilesById(params: {
  profileIds: string[];
  pool: Pool;
}): Promise<Map<string, unknown>> {
  const profilesById = new Map<string, unknown>();

  for (const targetProfileId of params.profileIds) {
    const targetProfile = await getProfile({
      profileId: targetProfileId,
      pool: params.pool,
      organizationId: undefined,
      addLinkedProfiles: false,
      consentSubjects: [],
    });

    profilesById.set(targetProfileId, targetProfile);
  }

  return profilesById;
}
