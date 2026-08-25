import { httpErrors } from "@fastify/sensible";
import type { ProfileWithEnhancedConsent } from "~/services/profiles/sql/find-profile-with-enhanced-consent.js";
import { toIsoDateTime } from "~/utils/dates.js";
import {
  type DetailType,
  type KnownProfileDataDetails,
  type KnownProfileDbDataDetails,
  type LinkedProfile,
  type MandatoryProfileDataDetails,
  MandatoryProfileDataDetailsSchema,
  type ProfileWithDetails,
  type ProfileWithDetailsFromDb,
  type ProfileWithLinkedProfiles,
} from "./model.js";

export function mergeProfileDataWithProfiles(
  profiles: ProfileWithDetailsFromDb[],
  profileData: Record<
    string,
    { firstName?: string; lastName?: string; ppsn?: string; email?: string }
  >,
): ProfileWithDetails[] {
  // Merges raw DB rows (`profiles`) with a pre-fetched map of profile details (`profileData`).
  // Context: used when we already have profile entity rows and a companion cache/map of
  // human-readable details keyed by `profileDetailsId`. This builds a view model for API
  // responses, ensuring downstream consumers receive normalized `details` while preserving
  // the original profile shape.
  const mergedProfiles = [];
  for (let i = 0; i < profiles.length; i++) {
    const profile = profiles[i];
    mergedProfiles.push({
      ...profile,
      details: {
        firstName: {
          type: "string",
          value: profileData[profile.profileDetailsId].firstName ?? "",
        },
        lastName: {
          type: "string",
          value: profileData[profile.profileDetailsId].lastName ?? "",
        },
        ppsn: {
          type: "string",
          value: profileData[profile.profileDetailsId].ppsn ?? "",
        },
        email: {
          type: "string",
          value:
            profileData[profile.profileDetailsId].email ?? profile.email ?? "",
        },
      },
    });
  }
  return parseProfilesDetails(mergedProfiles as ProfileWithDetailsFromDb[]);
}

function parseProfilesDetails(
  inputItems: ProfileWithDetailsFromDb[],
): ProfileWithDetails[] {
  // Vectorized convenience: apply the single-item parser to a list of profiles.
  // Keeps the parsing logic in one place and guarantees consistent normalization.
  return inputItems.map((i) => parseProfileDetails(i));
}

export function parseProfileDetails(
  inputItem:
    | Omit<ProfileWithDetailsFromDb, "profileDetailsId">
    | ProfileWithEnhancedConsent,
  linkedProfiles?: LinkedProfile[],
): ProfileWithDetails {
  // Central detail normalizer for a single profile. Converts the flexible DB-shaped
  // `details` payload to the public API shape while:
  // - Normalizing dates to ISO format
  // - Preserving only existing keys (no accidental undefined fields)
  // - Enforcing mandatory fields (via `parseMandatoryDetail`)
  // - Optionally attaching `linkedProfiles` to provide relationship context in one go
  // This is typically invoked by service layers composing API responses, including
  // enhanced-consent queries that attach consent context to the base profile.
  const withLinkedProfiles: { linkedProfiles?: LinkedProfile[] } = {};
  if (linkedProfiles && linkedProfiles.length > 0) {
    withLinkedProfiles.linkedProfiles = linkedProfiles;
  }

  if (!inputItem.details) {
    return { ...inputItem, details: undefined, ...withLinkedProfiles };
  }

  // in this way we extract the keys that exist on this instance
  // without setting undefined additional ones in output
  const keys: (keyof KnownProfileDbDataDetails)[] = Object.keys(
    inputItem.details,
  ) as unknown as (keyof KnownProfileDbDataDetails)[];
  const outputDetails: Record<string, string | undefined> = {};

  for (const key of keys) {
    outputDetails[key] = parseSingleDetail(inputItem.details[key]);
  }

  const mandatoryKeys: (keyof MandatoryProfileDataDetails)[] = Object.keys(
    MandatoryProfileDataDetailsSchema.properties,
  ) as unknown as (keyof MandatoryProfileDataDetails)[];

  const mandatoryDetails: Record<string, string> = {};
  for (const key of mandatoryKeys) {
    mandatoryDetails[key] = parseMandatoryDetail(key, inputItem.details[key]);
  }

  return {
    ...inputItem,
    // Ensure top-level email is in sync with details.email
    email: mandatoryDetails.email ?? outputDetails.email ?? inputItem.email,
    details: {
      ...outputDetails,
      ...mandatoryDetails,
    } as KnownProfileDataDetails,
    ...withLinkedProfiles,
  };
}

export function parseProfileDetailsWithLinkedProfiles(
  inputItem:
    | Omit<ProfileWithDetailsFromDb, "profileDetailsId">
    | ProfileWithEnhancedConsent,
  linkedProfiles: LinkedProfile[],
): ProfileWithLinkedProfiles {
  // Convenience wrapper to always return a profile including `linkedProfiles`.
  // Used by endpoints that must surface relationship context (e.g., guardians, dependants)
  // alongside normalized profile details, without duplicating merge logic.
  const profile = parseProfileDetails(inputItem) as ProfileWithLinkedProfiles;

  if (linkedProfiles.length === 0) {
    return profile;
  }

  profile.linkedProfiles = linkedProfiles;
  return profile;
}

function parseSingleDetail(inputDetail?: {
  type: DetailType;
  value: string;
}): string | undefined {
  // Normalizes an individual detail field. Dates are converted to ISO so that
  // consumers receive a consistent and sortable representation. Non-date values
  // pass through as strings.
  if (!inputDetail) {
    return undefined;
  }
  if (inputDetail.type === "date") {
    return toIsoDateTime(inputDetail.value);
  }
  return inputDetail.value.toString();
}

function parseMandatoryDetail(
  propertyName: string,
  inputDetail?: {
    type: DetailType;
    value: string;
  },
): string {
  // Ensures required fields are present and normalized.
  // If missing, throws a 500 to indicate an unexpected data contract breach
  // between persistence and API layers. This surfaces operational issues early
  // rather than returning partial/ambiguous payloads.
  if (!inputDetail) {
    throw httpErrors.internalServerError(
      `Missing mandatory detail ${propertyName}`,
    );
  }

  return parseSingleDetail(inputDetail) as string;
}

export function parseProfileDbDetails(
  dbDetails: Record<string, { value: string; type: string }> | null | undefined,
): KnownProfileDataDetails | undefined {
  // Translates the DB-native details object (as stored/queried) into the
  // API-facing shape with normalized values. This is used when details are
  // retrieved as a raw JSON object from SQL and need to be aligned with the
  // rest of the profile parsing pipeline (e.g., date to ISO conversion).
  if (!dbDetails) return undefined;

  const parsedDetails: Record<string, string> = {};

  for (const [key, detail] of Object.entries(dbDetails)) {
    if (detail && typeof detail === "object" && "value" in detail) {
      const detailObj = detail as { value: string; type: string };
      if (detailObj.type === "date") {
        parsedDetails[key] = toIsoDateTime(detailObj.value);
      } else {
        parsedDetails[key] = detailObj.value;
      }
    }
  }

  return parsedDetails as KnownProfileDataDetails;
}
