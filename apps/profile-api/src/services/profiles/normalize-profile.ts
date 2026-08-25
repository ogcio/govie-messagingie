import crypto from "node:crypto";
import {
  type ImportProfilesImportType,
  ImportProfilesImportTypesEnum,
} from "~/schemas/profiles/import-profiles.js";
import type {
  KnownProfileDataDetails,
  PpsnOnlyProfileDataDetails,
} from "~/schemas/profiles/model.js";

type ProfileRow = KnownProfileDataDetails;
type PpsnOnlyProfileRow = PpsnOnlyProfileDataDetails;

export const normalizeProfiles = (
  inputProfiles: ProfileRow[] | PpsnOnlyProfileRow[],
  importType: ImportProfilesImportType = ImportProfilesImportTypesEnum.Full,
): ProfileRow[] => {
  return inputProfiles.map((input) =>
    importType === ImportProfilesImportTypesEnum.PpsnOnly
      ? normalizePpsnOnlyProfile(input as PpsnOnlyProfileRow)
      : normalizeProfile(input as ProfileRow),
  );
};

export const normalizeProfile = (inputProfile: ProfileRow): ProfileRow => {
  const ppsn =
    inputProfile.ppsn && inputProfile.ppsn.trim().length > 0
      ? inputProfile.ppsn.trim().toUpperCase()
      : undefined;
  const email = inputProfile.email.toLowerCase();

  return {
    ...inputProfile,
    ppsn,
    email,
  };
};

export const normalizePpsnOnlyProfile = (
  inputProfile: PpsnOnlyProfileRow,
): ProfileRow => {
  if (!inputProfile.ppsn || inputProfile.ppsn.trim().length === 0) {
    throw new Error("PPSN is required for PPSN-only profile imports");
  }

  const ppsn = inputProfile.ppsn.trim().toUpperCase();
  const email = generateEmailFromPpsn(ppsn);
  const publicName = generatePublicNameFromPpsn(ppsn);
  const externalId = inputProfile.externalId;

  return {
    firstName: publicName,
    lastName: publicName,
    email,
    ppsn,
    externalId,
    dateOfBirth: inputProfile.dateOfBirth?.trim(),
  } as ProfileRow;
};

const generateEmailFromPpsn = (ppsn: string): string => {
  // Generate a deterministic random identifier based on PPSN
  const hash = crypto.createHash("sha256").update(ppsn).digest("hex");
  const identifier = hash.substring(0, 10); // Using first 10 chars of hash

  // Format: user-{random-id}@interim.gov.ie
  return `user-${identifier}@interim.gov.ie`;
};

const generatePublicNameFromPpsn = (ppsn: string): string => {
  // Generate a deterministic random identifier based on PPSN
  const hash = crypto.createHash("sha256").update(ppsn).digest("hex");
  const identifier = hash.substring(0, 8); // Using first 8 chars of hash for better uniqueness

  // Format: User-{random-id}
  return `User-${identifier}`;
};
