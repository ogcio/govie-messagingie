import type { Profile } from "@ogcio/building-blocks-sdk/dist/client/clients/profile/index.js";
import { extractSdkErrorDetail } from "../clients/sdk-error.js";
import type { ResolvedUser } from "../domain/types.js";

function getObjectRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value == null) {
    return null;
  }
  return value as Record<string, unknown>;
}

function firstProfileId(data: unknown): string | null {
  const envelope = getObjectRecord(data);
  const list = envelope && "data" in envelope ? envelope.data : data;

  const items = Array.isArray(list) ? list : list == null ? [] : [list];
  for (const item of items) {
    const record = getObjectRecord(item);
    const id = record?.id;
    if (typeof id === "string" && id.length > 0) {
      return id;
    }
  }
  return null;
}

/**
 * Resolves a user identifier into a profile id.
 *
 * - If the value contains "@", it is treated as an email and resolved via
 *   `profile.findProfile({ email, consentSubjects: ["messaging"] })`.
 * - Otherwise it is used directly as a profile id.
 */
export async function resolveUser(params: {
  profile: Profile;
  identifier: string;
}): Promise<ResolvedUser> {
  const { profile, identifier } = params;

  if (!identifier.includes("@")) {
    return { identifier, profileId: identifier, resolvedVia: "profileId" };
  }

  // Assign to a variable first to avoid an excess-property check against the
  // SDK's loosely-typed query parameter.
  const findProfileQuery = {
    email: identifier,
    consentSubjects: ["messaging"] as string[],
  };
  const response = await profile.findProfile(findProfileQuery);

  if (response.error) {
    throw new Error(
      `findProfile failed for "${identifier}": ${extractSdkErrorDetail(response.error)}`,
    );
  }

  const profileId = firstProfileId(response.data);
  if (profileId == null) {
    throw new Error(
      `No profile found for email "${identifier}". Confirm the account exists in this environment.`,
    );
  }

  return { identifier, profileId, resolvedVia: "email" };
}
