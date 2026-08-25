import type { HttpError } from "@fastify/sensible";
import type { PoolClient } from "pg";
import Value from "typebox/value";
import { KnownProfileDataDetailsSchema } from "~/schemas/profiles/model.js";
import { toIsoDate } from "~/utils/dates.js";
import { withRollback } from "~/utils/with-rollback.js";
import {
  createProfileDataForProfileDetail,
  createProfileDataForProfileDetailsBulk,
} from "./sql/create-profile-data-for-profile-details.js";
import {
  createProfileDetails,
  createProfileDetailsBulk,
} from "./sql/create-profile-details.js";
import {
  findProfilesWithDataBulk,
  findProfileWithData,
} from "./sql/find-profile-with-data.js";
import {
  updateProfileDetailsToLatestBulk,
  updateProfileDetailsToNonLatest,
} from "./sql/update-profile-details-to-non-latest.js";

export class ProfileDetailsError implements HttpError {
  status = 500;
  statusCode = 500;
  expose = true;
  name = "ProfileDetails";
  message = "error working on profile details";

  constructor(message?: string) {
    this.name = message ?? this.name;
  }
}

export const createUpdateProfileDetails = async ({
  client,
  organizationId,
  profileId,
  data,
  createOnly,
}: {
  client: PoolClient;
  organizationId: string | undefined;
  profileId: string;
  data: Record<string, string | number>;
  createOnly: boolean;
}): Promise<string | undefined> => {
  try {
    return await withRollback(client, async () => {
      const profileWithData = await findProfileWithData(
        client,
        organizationId,
        profileId,
        [],
      );

      let previousProfileDetails = {};
      // if the details already exist but we just want to create
      // don't do anything
      if (profileWithData?.details && createOnly) {
        return;
      }

      if (profileWithData?.details) {
        previousProfileDetails = Object.fromEntries(
          Object.entries(profileWithData.details).map(([key, value]) => [
            key,
            value.value,
          ]),
        );
      }
      const toSetDetails = checkIfProfileDetailsNeedToBeUpdated(
        previousProfileDetails,
        { ...previousProfileDetails, ...data },
      );

      if (!toSetDetails.needsUpdate) {
        return;
      }

      const profileDetailId = await createProfileDetails(
        client,
        profileId,
        organizationId,
      );

      await createProfileDataForProfileDetail(
        client,
        profileDetailId,
        toSetDetails.newDetails,
      );

      await updateProfileDetailsToNonLatest(
        client,
        profileDetailId,
        organizationId,
        profileId,
      );

      return profileDetailId;
    });
  } catch (error) {
    if (error instanceof ProfileDetailsError) {
      throw error;
    }
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    throw new ProfileDetailsError(
      `Failed to create/update profile details: ${message}`,
    );
  }
};

const checkIfProfileDetailsNeedToBeUpdated = (
  previousProfileDetails: Record<string, string>,
  newDetails: Record<string, string | number>,
): { needsUpdate: boolean; newDetails: Record<string, string | number> } => {
  const noEmptyDetails: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(newDetails)) {
    if (
      !(
        (typeof v === "string" && v.length === 0) ||
        v === null ||
        typeof v === "undefined"
      )
    ) {
      noEmptyDetails[k] = v;
    }
  }

  let cleanedDetails = Value.Clean(
    KnownProfileDataDetailsSchema,
    noEmptyDetails,
  ) as Record<string, string | number>;

  cleanedDetails = formatInputDataForProfileDetails(cleanedDetails);

  if (
    JSON.stringify(Object.keys(cleanedDetails).sort()) !==
    JSON.stringify(Object.keys(previousProfileDetails).sort())
  ) {
    return { needsUpdate: true, newDetails: cleanedDetails };
  }

  for (const newKey in cleanedDetails) {
    if (
      !previousProfileDetails[newKey] ||
      cleanedDetails[newKey] !== previousProfileDetails[newKey]
    ) {
      return { needsUpdate: true, newDetails: cleanedDetails };
    }
  }

  return { needsUpdate: false, newDetails: cleanedDetails };
};

const formatInputDataForProfileDetails = (
  data: Record<string, string | number>,
): Record<string, string | number> => {
  const outputData = { ...data };
  const toFormatFields: Record<
    string,
    (value: string | number) => string | number
  > = {
    dateOfBirth: (value) => toIsoDate(value.toString()),
  };

  for (const [key, formatter] of Object.entries(toFormatFields)) {
    if (!(key in outputData)) {
      continue;
    }

    const value = outputData[key];

    if (typeof value !== "string" && typeof value !== "number") {
      continue;
    }

    try {
      outputData[key] = formatter(value);
    } catch {
      outputData[key] = value;
    }
  }

  return outputData;
};

export const createUpdateProfileDetailsBulk = async ({
  client,
  organizationId,
  profiles,
  createOnly,
}: {
  client: PoolClient;
  organizationId: string | undefined;
  profiles: { profileId: string; data: Record<string, string | number> }[];
  createOnly: boolean;
}): Promise<string[]> => {
  try {
    return await withRollback(client, async () => {
      // Find all existing profiles with data
      const existingProfiles = await findProfilesWithDataBulk(
        client,
        organizationId,
        profiles.map((p) => p.profileId),
      );

      const existingProfilesMap = new Map(
        existingProfiles.map((p) => [p.id, p]),
      );

      // Use reduce to accumulate profileIds and data to update
      const { profileIds, data } = profiles.reduce(
        (acc, { profileId, data }) => {
          const existingProfile = existingProfilesMap.get(profileId);
          if (!existingProfile) {
            acc.profileIds.push(profileId);
            acc.data.push(data);
            return acc;
          }
          if (existingProfile.details && createOnly) return acc;

          const previousProfileDetails = Object.keys(
            existingProfile.details ?? {},
          ).reduce(
            (acc2, key) => {
              acc2[key] = (
                existingProfile.details as Record<string, { value: string }>
              )?.[key]?.value;
              return acc2;
            },
            {} as Record<string, string>,
          );

          const toSetDetails = checkIfProfileDetailsNeedToBeUpdated(
            previousProfileDetails,
            { ...previousProfileDetails, ...data },
          );

          if (toSetDetails.needsUpdate) {
            acc.profileIds.push(profileId);
            acc.data.push(data);
          }
          return acc;
        },
        {
          profileIds: [] as string[],
          data: [] as Record<string, string | number>[],
        },
      );

      if (profileIds.length === 0) {
        return [];
      }

      // Create profile details in bulk
      const profileDetailIds = await createProfileDetailsBulk(
        client,
        profileIds,
        organizationId,
      );

      // Create profile data in bulk
      await createProfileDataForProfileDetailsBulk(
        client,
        profileDetailIds,
        data,
      );

      // Update latest flag in bulk
      await updateProfileDetailsToLatestBulk(
        client,
        profileDetailIds,
        organizationId,
        profileIds,
      );

      return profileDetailIds;
    });
  } catch (error) {
    if (error instanceof ProfileDetailsError) {
      throw error;
    }
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    throw new ProfileDetailsError(
      `Failed to create/update profile details in bulk: ${message}`,
    );
  }
};
