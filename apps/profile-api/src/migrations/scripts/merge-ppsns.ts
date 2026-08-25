import type { Pool, PoolClient } from "pg";
import pino from "pino";
import type {
  GetUserResponse,
  LogtoClient,
  LogtoError,
} from "~/clients/logto.js";
import type { ProfileWithLinkedProfiles } from "~/schemas/profiles/model.js";
import { getProfile } from "~/services/profiles/get-profile.js";
import { updateProfile } from "~/services/profiles/update-profile.js";

export const ONBOARDED_ROLE_ID = "onboarded-citizen";

type LogtoUserInfo =
  | {
      profileId: string;
      loggedIn: boolean;
      hasOnboardedRole: boolean;
      myGovIdVerified: boolean | null;
      myGovIdId: string | null;
    }
  | { found: false; profileId: string };

export const DuplicatedPPSNsFurtherAnalysisReasons = {
  // Multiple profiles that share the same PPSN have private details
  MULTIPLE_PROFILES_WITH_PRIVATE_DETAILS:
    "MULTIPLE_PROFILES_WITH_PRIVATE_DETAILS",
} as const;

type DuplicatedPPSNsFurtherAnalysisReason =
  (typeof DuplicatedPPSNsFurtherAnalysisReasons)[keyof typeof DuplicatedPPSNsFurtherAnalysisReasons];

export const DuplicatedPPSNsErrorTypes = {
  // Error fetching profile from the database
  FETCH_PROFILE: "FETCH_PROFILE",
  // Multiple profiles in the group are already primary (have linked profiles)
  MULTIPLE_PROFILES_ALREADY_PRIMARY: "MULTIPLE_PROFILES_ALREADY_PRIMARY",
  // Multiple profiles are children and are linked to different primary profiles
  ALREADY_LINKED_TO_MULTIPLE_PRIMARY_PROFILES:
    "ALREADY_LINKED_TO_MULTIPLE_PRIMARY_PROFILES",
  // The primary profile for the children is not in the PPSN group,
  // meaning that the children are linked to a profile with a different PPSN
  PRIMARY_PROFILE_NOT_IN_GROUP: "PRIMARY_PROFILE_NOT_IN_GROUP",
  // No profiles in the group have private details
  NO_PRIVATE_DETAILS: "NO_PRIVATE_DETAILS",
  // Error thrown while invoking update profile to link profiles
  ERROR_LINKING_PROFILES: "ERROR_LINKING_PROFILES",
  // Error thrown while invoking Logto to get user details
  LOGTO_FETCH: "LOGTO_FETCH",
  // No profiles found in Logto for the given profile IDs
  NO_PROFILES_FOUND_IN_LOGTO: "NO_PROFILES_FOUND_IN_LOGTO",
  // No profiles in the group have ever logged in (no lastSignInAt found in Logto)
  NO_LOGINS_FOUND_IN_LOGTO: "NO_LOGINS_FOUND_IN_LOGTO",
  // Multiple profiles in the group have logged in (multiple lastSignInAt found in Logto)
  MULTIPLE_LOGTO_LOGINS: "MULTIPLE_LOGTO_LOGINS",
  // No profiles in the group have verified MyGovId
  NO_VERIFIED_MYGOVID: "NO_VERIFIED_MYGOVID",
  // Multiple profiles in the group have verified MyGovId
  MULTIPLE_VERIFIED_MYGOVID: "MULTIPLE_VERIFIED_MYGOVID",
  // Multiple profiles in the group have onboarded role
  MULTIPLE_ONBOARDED_ROLES: "MULTIPLE_ONBOARDED_ROLES",
  // No profiles in the group have onboarded role
  NO_ONBOARDED_ROLE: "NO_ONBOARDED_ROLE",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const;

type DuplicatedPPSNSErrorType =
  (typeof DuplicatedPPSNsErrorTypes)[keyof typeof DuplicatedPPSNsErrorTypes];

type DuplicatedProfilesByPPSN = Record<
  string,
  {
    // The profiles mapped by their IDs
    profileByIds: Record<string, ProfileWithLinkedProfiles>;
    // Set of profile IDs that are already parent profiles (have linked profiles)
    alreadyParentProfileIds: Set<string>;
    // The profile ID that has been selected as primary for the group
    primaryProfileId: string | undefined;
    // Set of profile IDs that are already child profiles (are linked to a primary profile)
    alreadyChildProfileIds: Set<string>;
    // Set of profile IDs that are already used as primary profile by profiles in the group
    primaryProfileIds: Set<string>;
    // Set of profile IDs that have private details
    withPrivateDetailsProfileIds: Set<string>;
    // Flag to indicate if the group needs further analysis (e.g., check latest login date)
    needsFurtherAnalysis:
      | { reason: DuplicatedPPSNsFurtherAnalysisReason }
      | undefined;
    // Any error encountered during processing
    // any error prevents further steps
    error: { error_type: DuplicatedPPSNSErrorType; error: string } | undefined;
  }
>;

type DuplicatedPPSNs = {
  ppsn: string;
  profile_ids: string[];
}[];

export async function mergePpsns(params: {
  pool: Pool;
  dryRun: boolean;
  getLogtoClient: () => Promise<LogtoClient>;
  logger?: pino.Logger;
}): Promise<DuplicatedProfilesByPPSN | undefined> {
  const pool = params.pool;
  const logger = params.logger ?? pino.pino();
  logger.info("Starting merge-ppsns script");
  const client = await pool.connect();
  let calculatedPrimaryProfileByPPSN: DuplicatedProfilesByPPSN | undefined = {};
  let csvEntries: string[] = [];
  try {
    const duplicatedPPSNs = await getDuplicatedPPSNs({ client, logger });
    if (duplicatedPPSNs.length === 0) {
      logger.info("No duplicated PPSNs found, exiting.");
      return;
    }

    const profilesByPPSN = await loadProfiles({
      client,
      logger,
      duplicatedPPSNs,
    });

    calculatedPrimaryProfileByPPSN = await calculatePrimaryForPPSNs({
      ppsnEntry: profilesByPPSN,
      logger,
    });

    const signInCheck = await checkSignIn({
      duplicatedPPSNs: calculatedPrimaryProfileByPPSN,
      logger,
      getLogtoClient: params.getLogtoClient,
    });

    calculatedPrimaryProfileByPPSN = signInCheck.duplicatedPPSNs;
    csvEntries = signInCheck.csvEntries;
  } catch (error) {
    // Given that the profile-api service can continue working even if this script fails,
    // we log the error and return undefined to indicate that the process did not complete successfully.
    logger.fatal({ error }, "Fatal error in merge-ppsns script");
    calculatedPrimaryProfileByPPSN = undefined;
  } finally {
    client.release();
  }

  if (!calculatedPrimaryProfileByPPSN) {
    logger.error("Early return due to no calculated primary profiles.");
    return;
  }

  try {
    calculatedPrimaryProfileByPPSN = await linkProfiles({
      logger,
      duplicatedPPSNs: calculatedPrimaryProfileByPPSN,
      dryRun: params.dryRun,
      pool,
      getLogtoClient: params.getLogtoClient,
    });
    printResume({ logger, grouped: calculatedPrimaryProfileByPPSN });
  } catch (error) {
    logger.fatal({ error }, "Fatal error in merge-ppsns script, linking step");
  }

  logger.info("CSV Entries:");
  logger.info(
    "PPSN,profileId,foundInLogto,MyGovIdId,loggedIn,myGovIdVerified,hasOnboardedRole,errorType",
  );
  for (const entry of csvEntries) {
    logger.info(`[CSV Entry] ${entry}`);
  }

  logger.info("");
  logger.info("");
  logger.info("");

  logger.info("Finished merge-ppsns script");
  return calculatedPrimaryProfileByPPSN;
}

async function getDuplicatedPPSNs(params: {
  client: PoolClient;
  logger: pino.Logger;
}): Promise<DuplicatedPPSNs> {
  try {
    params.logger.info("[GetDuplicatedPPSNS] Fetching duplicated PPSNs");
    const query = `
    SELECT
        pd.value AS ppsn,
        array_agg(DISTINCT pr.id) AS profile_ids
    FROM profile_data pd
    JOIN profile_details pdet ON pd.profile_details_id = pdet.id
    JOIN profiles pr ON pdet.profile_id = pr.id
    WHERE pd.name ILIKE 'ppsn'
    GROUP BY pd.value
    HAVING count(DISTINCT pr.id) > 1;`;

    const res = await params.client.query<DuplicatedPPSNs[number]>(query);
    params.logger.info(
      `[GetDuplicatedPPSNS] Found ${res.rowCount} duplicated PPSNs`,
    );

    return res.rows;
  } catch (err) {
    params.logger.error(
      { error: err },
      "[GetDuplicatedPPSNS] Error fetching duplicated PPSNs",
    );
    return [];
  }
}

async function loadProfiles(params: {
  client: PoolClient;
  logger: pino.Logger;
  duplicatedPPSNs: DuplicatedPPSNs;
}): Promise<DuplicatedProfilesByPPSN> {
  params.logger.info("[LoadProfiles] Loading profiles for duplicated PPSNs");
  const profilesByPPSN: DuplicatedProfilesByPPSN = {};
  for (const entry of params.duplicatedPPSNs) {
    profilesByPPSN[entry.ppsn] = {
      profileByIds: {},
      primaryProfileId: undefined,
      alreadyParentProfileIds: new Set<string>(),
      alreadyChildProfileIds: new Set<string>(),
      primaryProfileIds: new Set<string>(),
      error: undefined,
      withPrivateDetailsProfileIds: new Set<string>(),
      needsFurtherAnalysis: undefined,
    };
    for (const profileId of entry.profile_ids) {
      try {
        const profile = await getProfile({
          client: params.client,
          organizationId: undefined,
          profileId,
          addLinkedProfiles: true,
          consentSubjects: [],
        });
        profilesByPPSN[entry.ppsn].profileByIds[profileId] = profile;
        if (profile.details && Object.keys(profile.details).length > 0) {
          profilesByPPSN[entry.ppsn].withPrivateDetailsProfileIds.add(
            profileId,
          );
        }
        if (profile.linkedProfiles && profile.linkedProfiles.length > 0) {
          profilesByPPSN[entry.ppsn].alreadyParentProfileIds.add(profileId);
        } else if (profile.id !== profile.primaryUserId) {
          profilesByPPSN[entry.ppsn].alreadyChildProfileIds.add(profileId);
          profilesByPPSN[entry.ppsn].primaryProfileIds.add(
            profile.primaryUserId,
          );
        }
      } catch (err) {
        params.logger.fatal(
          { error: err },
          `[LoadProfiles] Error loading profile ${profileId} for PPSN ${entry.ppsn}`,
        );
        profilesByPPSN[entry.ppsn].error = {
          error_type: DuplicatedPPSNsErrorTypes.FETCH_PROFILE,
          error: `${profileId} - ${getErrorMessage(err)}`,
        };
      }
    }
  }
  params.logger.info("[LoadProfiles] Finished loading profiles");

  return profilesByPPSN;
}

async function calculatePrimaryForPPSNs(params: {
  ppsnEntry: DuplicatedProfilesByPPSN;
  logger: pino.Logger;
}): Promise<DuplicatedProfilesByPPSN> {
  params.logger.info(
    "[CalculatePrimaryForPPSN] Calculating primary profile for PPSN",
  );

  for (let [ppsn, grouped] of Object.entries(params.ppsnEntry)) {
    // check if previous errors
    if (grouped.error) {
      params.logger.warn(
        `[CalculatePrimaryForPPSN] Skipping PPSN ${ppsn} due to errors loading profiles`,
      );
      continue;
    }
    const profileIdsForPPSN = Object.keys(grouped.profileByIds);
    // If multiple profiles in the group are already parents (have linked profiles)
    // skip the PPSN to be able to review manually
    const alreadyParentsResult = checkMultipleAlreadyParents({
      logger: params.logger,
      grouped,
      ppsn,
    });
    if (!alreadyParentsResult.moveToNextSteps) {
      continue;
    }
    grouped = alreadyParentsResult.grouped;

    // If profiles are children and are linked to different primary profiles
    // or the primary profile is not in the PPSN group, skip the PPSN to be able to review manually
    const alreadyChildsResult = checkAlreadyChildProfiles({
      logger: params.logger,
      grouped,
      ppsn,
    });
    if (!alreadyChildsResult.moveToNextSteps) {
      continue;
    }
    grouped = alreadyChildsResult.grouped;

    // If we are here it means that the children (if any) are linked to the same primary profile
    // and that primary profile is in the PPSN group
    if (grouped.alreadyParentProfileIds.size === 1) {
      grouped.primaryProfileId = Array.from(grouped.alreadyParentProfileIds)[0];
      params.logger.info(
        `[CalculatePrimaryForPPSN] PPSN ${ppsn} has one profile with linked profiles, setting as primary: ${grouped.primaryProfileId}`,
      );
      continue;
    }

    // If we falls here it means that no profiles are linked to others
    // and only one has private details, set that one as primary
    if (grouped.withPrivateDetailsProfileIds.size === 1) {
      const withPrivateDetailsProfileId = Array.from(
        grouped.withPrivateDetailsProfileIds,
      )[0];
      grouped.primaryProfileId = withPrivateDetailsProfileId;
      params.logger.info(
        `[CalculatePrimaryForPPSN] PPSN ${ppsn} has one profile with private details, setting as primary: ${grouped.primaryProfileId}`,
      );
      continue;
    }

    // If we falls here it means that no profiles have private details,
    // skip the PPSN to be able to review manually
    if (grouped.withPrivateDetailsProfileIds.size === 0) {
      params.logger.warn(
        `[CalculatePrimaryForPPSN] Skipping PPSN ${ppsn} because has no profiles with private details`,
      );
      grouped.error = {
        error_type: DuplicatedPPSNsErrorTypes.NO_PRIVATE_DETAILS,
        error: `No profiles with private details found in group ${profileIdsForPPSN.join(", ")}`,
      };
      continue;
    }
    // If we falls here it means that multiple profiles have private details,
    // move on invoking logto to check the latest login date
    grouped.needsFurtherAnalysis = {
      reason:
        DuplicatedPPSNsFurtherAnalysisReasons.MULTIPLE_PROFILES_WITH_PRIVATE_DETAILS,
    };
    grouped.primaryProfileId = undefined;
    grouped.error = undefined;
    params.logger.warn(
      `[CalculatePrimaryForPPSN] PPSN ${ppsn} needs further analysis, multiple profiles with private details: ${Array.from(grouped.withPrivateDetailsProfileIds).join(", ")}`,
    );
  }

  return params.ppsnEntry;
}

function checkMultipleAlreadyParents({
  logger,
  grouped,
  ppsn,
}: {
  ppsn: string;
  logger: pino.Logger;
  grouped: DuplicatedProfilesByPPSN[string];
}): { grouped: DuplicatedProfilesByPPSN[string]; moveToNextSteps: boolean } {
  if (grouped.alreadyParentProfileIds.size <= 1) {
    return { grouped, moveToNextSteps: true };
  }

  const alreadyParentProfileIdsArray = Array.from(
    grouped.alreadyParentProfileIds,
  );
  grouped.error = {
    error_type: DuplicatedPPSNsErrorTypes.MULTIPLE_PROFILES_ALREADY_PRIMARY,
    error: `Multiple profiles with linked profiles: ${alreadyParentProfileIdsArray.join(", ")}`,
  };
  logger.warn(
    `[CalculatePrimaryForPPSN] Skipping PPSN ${ppsn} due to multiple profiles with already linked profiles`,
  );

  return { grouped, moveToNextSteps: false };
}

function checkAlreadyChildProfiles({
  logger,
  grouped,
  ppsn,
}: {
  ppsn: string;
  logger: pino.Logger;
  grouped: DuplicatedProfilesByPPSN[string];
}): { grouped: DuplicatedProfilesByPPSN[string]; moveToNextSteps: boolean } {
  const profileIdsForPPSN = Object.keys(grouped.profileByIds);

  if (grouped.alreadyChildProfileIds.size === 0) {
    return { grouped, moveToNextSteps: true };
  }

  if (grouped.primaryProfileIds.size > 1) {
    const primaryProfileIdsArray = Array.from(grouped.primaryProfileIds);
    grouped.error = {
      error_type:
        DuplicatedPPSNsErrorTypes.ALREADY_LINKED_TO_MULTIPLE_PRIMARY_PROFILES,
      error: `Multiple primary profiles found for child profiles: ${primaryProfileIdsArray.join(", ")}`,
    };
    logger.warn(
      `[CalculatePrimaryForPPSN] Skipping PPSN ${ppsn} due to multiple primary profiles for child profiles`,
    );

    return { grouped, moveToNextSteps: false };
  }
  const primaryProfileId = Array.from(grouped.primaryProfileIds)[0];
  if (profileIdsForPPSN.includes(primaryProfileId)) {
    grouped.primaryProfileId = primaryProfileId;
    logger.info(
      `[CalculatePrimaryForPPSN] PPSN ${ppsn} already has a primary user in group ${primaryProfileId} to which other profiles are linked`,
    );

    return { grouped, moveToNextSteps: false };
  }

  logger.warn(
    `[CalculatePrimaryForPPSN] Skipping PPSN ${ppsn} because primary profile ${primaryProfileId} for child profiles is not in the group ${profileIdsForPPSN.join(", ")}`,
  );
  grouped.error = {
    error_type: DuplicatedPPSNsErrorTypes.PRIMARY_PROFILE_NOT_IN_GROUP,
    error: `Primary profile ${primaryProfileId} for child profiles is not in the group ${profileIdsForPPSN.join(", ")}`,
  };

  return { grouped, moveToNextSteps: false };
}

async function linkProfiles({
  logger,
  duplicatedPPSNs,
  dryRun,
  pool,
  getLogtoClient,
}: {
  logger: pino.Logger;
  duplicatedPPSNs: DuplicatedProfilesByPPSN;
  dryRun: boolean;
  pool: Pool;
  getLogtoClient: () => Promise<LogtoClient>;
}): Promise<DuplicatedProfilesByPPSN> {
  for (const [ppsn, entry] of Object.entries(duplicatedPPSNs)) {
    // skipping because of previous errors
    if (entry.error) {
      continue;
    }

    if (entry.primaryProfileId) {
      const error = await linkProfilesForSinglePPSN({
        ppsn,
        profileByIds: entry.profileByIds,
        primaryProfileId: entry.primaryProfileId,
        logger,
        pool,
        getLogtoClient,
        dryRun,
      });
      if (error) {
        entry.error = error;
      }
      continue;
    }
    if (entry.needsFurtherAnalysis) {
      logger.warn(
        `[LinkProfiles] Skipping PPSN ${ppsn} because needs further analysis LOGTO.`,
      );
      continue;
    }

    logger.fatal(
      { ppsn, profileByIds: entry.profileByIds },
      `[LinkProfiles] PPSN ${ppsn} has no primaryProfileId and does not need further analysis, this should not happen!`,
    );
  }

  return duplicatedPPSNs;
}

async function linkProfilesForSinglePPSN(params: {
  ppsn: string;
  profileByIds: Record<string, ProfileWithLinkedProfiles>;
  logger: pino.Logger;
  primaryProfileId: string;
  pool: Pool;
  getLogtoClient: () => Promise<LogtoClient>;
  dryRun: boolean;
}): Promise<
  { error_type: DuplicatedPPSNSErrorType; error: string } | undefined
> {
  const {
    profileByIds,
    logger,
    primaryProfileId,
    pool,
    getLogtoClient,
    dryRun,
    ppsn,
  } = params;

  const childrenToLink = Object.keys(profileByIds).filter(
    (id) => id !== primaryProfileId,
  );
  logger.warn(
    {
      primaryProfileId,
      childrenProfileIds: childrenToLink,
    },
    `[LinkProfiles] Linking profiles for PPSN ${ppsn}.`,
  );
  if (dryRun) {
    return undefined;
  }
  const failedIds: string[] = [];
  for (const childProfileId of childrenToLink) {
    try {
      await updateProfile({
        getLogtoClient,
        updateRequestedById: primaryProfileId,
        toUpdateProfileId: childProfileId,
        toSetProfileData: { primaryUserId: primaryProfileId },
        pool,
        logger,
      });
    } catch (error) {
      failedIds.push(childProfileId);
      logger.error(
        { error, childProfileId, primaryProfileId },
        `[LinkProfiles] Error linking profile ${childProfileId} to primary profile ${primaryProfileId}`,
      );
    }
  }
  if (failedIds.length === 0) {
    return undefined;
  }

  return {
    error_type: DuplicatedPPSNsErrorTypes.ERROR_LINKING_PROFILES,
    error: `Failed to link the following profiles to primary profile ${primaryProfileId}: ${failedIds.join(", ")}`,
  };
}

async function checkSignIn({
  logger,
  duplicatedPPSNs,
  getLogtoClient,
}: {
  logger: pino.Logger;
  duplicatedPPSNs: DuplicatedProfilesByPPSN;
  getLogtoClient: () => Promise<LogtoClient>;
}): Promise<{
  duplicatedPPSNs: DuplicatedProfilesByPPSN;
  csvEntries: string[];
}> {
  const atLeastOneNeedsAnalysis = Object.values(duplicatedPPSNs).some(
    (entry) => entry.needsFurtherAnalysis,
  );
  if (!atLeastOneNeedsAnalysis) {
    return { duplicatedPPSNs, csvEntries: [] };
  }

  const logtoClient = await getLogtoClient();
  const csvEntries: string[] = [];
  for (const [ppsn, entries] of Object.entries(duplicatedPPSNs)) {
    if (!entries.needsFurtherAnalysis || entries.error) {
      continue;
    }

    entries.needsFurtherAnalysis = undefined;

    const logtoData = await getLogtoDataForPPSN({
      logtoClient,
      profileIdsForPPSN: Object.keys(entries.profileByIds),
    });

    if (logtoData.error) {
      entries.error = logtoData.error;
      continue;
    }
    const analysisResult = await analyzeLogtoDataPerPPSN(
      ppsn,
      logtoData.logtoUsersInfo,
      logger,
    );
    if ("error" in analysisResult) {
      entries.error = analysisResult.error;
      continue;
    }

    entries.primaryProfileId = analysisResult.primaryProfileId;
    logger.info(
      `[CheckSignIn] PPSN ${ppsn} primary profile set to ${entries.primaryProfileId} after Logto analysis.`,
    );
    csvEntries.push(...analysisResult.csvEntries);
  }
  return { duplicatedPPSNs, csvEntries };
}

async function analyzeLogtoDataPerPPSN(
  ppsn: string,
  logtoUsersInfo: LogtoUserInfo[],
  logger: pino.Logger,
): Promise<
  { csvEntries: string[] } & (
    | { error: { error_type: DuplicatedPPSNSErrorType; error: string } }
    | { primaryProfileId: string }
  )
> {
  // CSV HEADER
  // PPSN,profileId,foundInLogto,MyGovIdId,loggedIn,myGovIdVerified,hasOnboardedRole,errorType
  const output: (string | number)[][] = [];
  const notFoundIds: string[] = [];
  const nullLogins: string[] = [];
  const actuallyLoggedIn: string[] = [];
  const verifiedMyGovIds: string[] = [];
  const onboardedRoles: string[] = [];
  const totalCount = logtoUsersInfo.length;
  for (const userInfo of logtoUsersInfo) {
    const currentRow: (string | number)[] = [ppsn, userInfo.profileId];
    // found is always false, if present
    if ("found" in userInfo) {
      currentRow.push(0, "", "", "", "");
      notFoundIds.push(userInfo.profileId);
      continue;
    }
    currentRow.push(1);
    currentRow.push(userInfo.myGovIdId ?? "");
    currentRow.push(userInfo.loggedIn ? 1 : 0);
    currentRow.push(
      userInfo.myGovIdVerified === null ? 0 : userInfo.myGovIdVerified ? 1 : 0,
    );
    currentRow.push(userInfo.hasOnboardedRole ? 1 : 0);

    output.push(currentRow);

    if (!userInfo.loggedIn) {
      nullLogins.push(userInfo.profileId);
    } else {
      actuallyLoggedIn.push(userInfo.profileId);
    }
    if (userInfo.myGovIdVerified) {
      verifiedMyGovIds.push(userInfo.profileId);
    }
    if (userInfo.hasOnboardedRole) {
      onboardedRoles.push(userInfo.profileId);
    }
  }

  const processCsvEntries = (
    entries: (string | number)[][],
    errorType: string | null,
  ): string[] => {
    const output: string[] = [];
    for (const row of entries) {
      if (errorType) {
        row.push(errorType);
      } else {
        row.push("");
      }
      output.push(row.join(","));
    }
    return output;
  };
  // The perfect situation must be that only one profile has MyGovId and it must be verified
  // and that profile must have the onboarded role
  if (
    verifiedMyGovIds.length === 1 &&
    onboardedRoles.length === 1 &&
    verifiedMyGovIds[0] === onboardedRoles[0] &&
    actuallyLoggedIn.length === 1 &&
    actuallyLoggedIn[0] === verifiedMyGovIds[0]
  ) {
    const primaryProfileId = verifiedMyGovIds[0];
    logger.info(
      `[CheckSignIn] PPSN ${ppsn} has one profile with verified MyGovId and onboarded role, setting as primary: ${primaryProfileId}`,
    );
    return { primaryProfileId, csvEntries: processCsvEntries(output, null) };
  }

  // No one of the profiles found in Logto
  if (notFoundIds.length === totalCount) {
    logger.warn(`[CheckSignIn] No profiles found in Logto for PPSN ${ppsn}`);
    return {
      csvEntries: processCsvEntries(
        output,
        DuplicatedPPSNsErrorTypes.NO_PROFILES_FOUND_IN_LOGTO,
      ),
      error: {
        error_type: DuplicatedPPSNsErrorTypes.NO_PROFILES_FOUND_IN_LOGTO,
        error: `No profiles found in Logto for any of the profile IDs for the ${ppsn} PPSN: ${notFoundIds.join(", ")}`,
      },
    };
  }

  if (nullLogins.length === totalCount) {
    logger.warn(
      `[CheckSignIn] No profiles have ever logged in for PPSN ${ppsn}`,
    );
    return {
      csvEntries: processCsvEntries(
        output,
        DuplicatedPPSNsErrorTypes.NO_LOGINS_FOUND_IN_LOGTO,
      ),
      error: {
        error_type: DuplicatedPPSNsErrorTypes.NO_LOGINS_FOUND_IN_LOGTO,
        error: `No profiles have ever logged in for any of the profile IDs: ${nullLogins.join(", ")}`,
      },
    };
  }

  if (actuallyLoggedIn.length > 1) {
    logger.warn(
      `[CheckSignIn] Multiple profiles have logged in for PPSN ${ppsn}, cannot determine primary profile: ${actuallyLoggedIn.join(", ")}`,
    );
    return {
      csvEntries: processCsvEntries(
        output,
        DuplicatedPPSNsErrorTypes.MULTIPLE_LOGTO_LOGINS,
      ),
      error: {
        error_type: DuplicatedPPSNsErrorTypes.MULTIPLE_LOGTO_LOGINS,
        error: `Multiple profiles have logged in for the profile IDs: ${actuallyLoggedIn.join(", ")}`,
      },
    };
  }

  if (verifiedMyGovIds.length === 0) {
    logger.warn(
      `[CheckSignIn] No profiles have verified MyGovId for PPSN ${ppsn}, cannot determine primary profile: ${Object.keys(logtoUsersInfo).join(", ")}`,
    );
    return {
      csvEntries: processCsvEntries(
        output,
        DuplicatedPPSNsErrorTypes.NO_VERIFIED_MYGOVID,
      ),
      error: {
        error_type: DuplicatedPPSNsErrorTypes.NO_VERIFIED_MYGOVID,
        error: `No profiles have verified MyGovId for any of the profile IDs: ${Object.keys(logtoUsersInfo).join(", ")}`,
      },
    };
  }

  if (verifiedMyGovIds.length > 1) {
    logger.warn(
      `[CheckSignIn] Multiple profiles have verified MyGovId for PPSN ${ppsn}, cannot determine primary profile: ${verifiedMyGovIds.join(", ")}`,
    );
    return {
      csvEntries: processCsvEntries(
        output,
        DuplicatedPPSNsErrorTypes.MULTIPLE_VERIFIED_MYGOVID,
      ),
      error: {
        error_type: DuplicatedPPSNsErrorTypes.MULTIPLE_VERIFIED_MYGOVID,
        error: `Multiple profiles have verified MyGovId for any of the profile IDs: ${verifiedMyGovIds.join(", ")}`,
      },
    };
  }

  if (onboardedRoles.length === 0) {
    logger.warn(
      `[CheckSignIn] No profiles have onboarded role for PPSN ${ppsn}, cannot determine primary profile: ${Object.keys(logtoUsersInfo).join(", ")}`,
    );
    return {
      csvEntries: processCsvEntries(
        output,
        DuplicatedPPSNsErrorTypes.NO_ONBOARDED_ROLE,
      ),
      error: {
        error_type: DuplicatedPPSNsErrorTypes.NO_ONBOARDED_ROLE,
        error: `No profiles have onboarded role for any of the profile IDs: ${Object.keys(logtoUsersInfo).join(", ")}`,
      },
    };
  }

  if (onboardedRoles.length > 1) {
    logger.warn(
      `[CheckSignIn] Multiple profiles have onboarded role for PPSN ${ppsn}, cannot determine primary profile: ${onboardedRoles.join(", ")}`,
    );
    return {
      csvEntries: processCsvEntries(
        output,
        DuplicatedPPSNsErrorTypes.MULTIPLE_ONBOARDED_ROLES,
      ),
      error: {
        error_type: DuplicatedPPSNsErrorTypes.MULTIPLE_ONBOARDED_ROLES,
        error: `Multiple profiles have onboarded role for any of the profile IDs: ${Object.keys(logtoUsersInfo).join(", ")}`,
      },
    };
  }

  return {
    csvEntries: processCsvEntries(
      output,
      DuplicatedPPSNsErrorTypes.UNKNOWN_ERROR,
    ),
    error: {
      error_type: DuplicatedPPSNsErrorTypes.UNKNOWN_ERROR,
      error: `Could not determine primary profile for PPSN ${ppsn} with profile IDs: ${Object.keys(logtoUsersInfo).join(", ")}`,
    },
  };
}

async function getLogtoDataForPPSN(params: {
  logtoClient: LogtoClient;
  profileIdsForPPSN: string[];
}): Promise<
  | {
      logtoUsersInfo: LogtoUserInfo[];
      error?: undefined;
    }
  | {
      logtoUsersInfo?: undefined;
      error: { error_type: DuplicatedPPSNSErrorType; error: string };
    }
> {
  const promises = params.profileIdsForPPSN.map(async (profileId) =>
    getLogtoDataForProfile(profileId, params.logtoClient),
  );
  const users = await Promise.allSettled(promises);
  const output: LogtoUserInfo[] = [];
  for (const [index, result] of users.entries()) {
    if (result.status === "rejected") {
      const currentProfileId = params.profileIdsForPPSN[index];
      return {
        error: {
          error_type: DuplicatedPPSNsErrorTypes.LOGTO_FETCH,
          error: `Error fetching user ${currentProfileId} from Logto: ${getErrorMessage(result.reason)}`,
        },
      };
    }
    output.push(result.value);
  }
  return { logtoUsersInfo: output };
}

async function getLogtoDataForProfile(
  profileId: string,
  logtoClient: LogtoClient,
): Promise<LogtoUserInfo> {
  let user: GetUserResponse | null = null;
  try {
    user = await logtoClient.getUser(profileId);
  } catch (error) {
    if (getLogtoErrorCode(error) === 404) {
      return { found: false, profileId };
    }
    throw error;
  }
  if (!user) {
    throw new Error("Logto user not found");
  }
  let hasOnboardedRole = false;
  try {
    const roles = await logtoClient.getUserRoles(profileId);
    hasOnboardedRole = roles.some((role) => role.id === ONBOARDED_ROLE_ID);
  } catch {
    // ignore the error here, we just won't add the role
  }
  const myGovIdConnector =
    user.identities["MyGovId (MyGovId connector)"] ?? null;
  const myGovIdLevel = myGovIdConnector
    ? myGovIdConnector.details?.rawData?.DSPOnlineLevel
    : null;
  const verified = myGovIdLevel ? Number(myGovIdLevel) >= 2 : null;
  const myGovIdId = myGovIdConnector ? myGovIdConnector.userId : null;

  return {
    myGovIdVerified: verified,
    profileId: user.id,
    loggedIn: !!user.lastSignInAt,
    hasOnboardedRole,
    myGovIdId,
  };
}

function getLogtoErrorCode(error: unknown): number | undefined {
  const errorObject =
    typeof error === "object" && error !== null ? error : null;
  if (
    errorObject &&
    errorObject.constructor.name === "LogtoError" &&
    "status" in errorObject
  ) {
    return Number((errorObject as LogtoError).status);
  }
  return undefined;
}

function printResume({
  logger,
  grouped,
}: {
  logger: pino.Logger;
  grouped: DuplicatedProfilesByPPSN;
}) {
  logger.info("");
  logger.info("");
  logger.info("========= RESUME =========");
  logger.info("");

  const succeeded: Record<
    string,
    { primaryProfileId: string; linkedProfileIds: string[] }
  > = {};
  const needsFurtherAnalysis: Record<
    string,
    { ids: string[]; reason: DuplicatedPPSNsFurtherAnalysisReason }
  > = {};
  const others: Record<string, string[]> = {};
  logger.info(`Total PPSNs processed: ${Object.keys(grouped).length}`);
  logger.info("");
  logger.info("========= PPSNs with issues =========");
  logger.info("");
  let countWithErrors = 0;
  for (const [ppsn, entry] of Object.entries(grouped)) {
    if (entry.error) {
      countWithErrors++;
      logger.info(
        {
          error: entry.error,
          primaryProfileId: entry.primaryProfileId,
          profileIds: Object.keys(entry.profileByIds),
        },
        `PPSN ${ppsn} had errors`,
      );
      continue;
    }
    if (entry.primaryProfileId && !entry.error) {
      succeeded[ppsn] = {
        primaryProfileId: entry.primaryProfileId,
        linkedProfileIds: Object.keys(entry.profileByIds).filter(
          (id) => id !== entry.primaryProfileId,
        ),
      };
      continue;
    }
    if (entry.needsFurtherAnalysis) {
      needsFurtherAnalysis[ppsn] = {
        ids: Object.keys(entry.profileByIds),
        reason: entry.needsFurtherAnalysis.reason,
      };
      continue;
    }
    others[ppsn] = Object.keys(entry.profileByIds);
  }

  logger.info("");
  logger.info(`Number of PPSNs with errors: ${countWithErrors}`);
  logger.info("");
  logger.info("========= END PPSNs with issues =========");
  logger.info("");
  logger.info("========= SUCCEEDED PPSNs =========");
  logger.info("");

  for (const [ppsn, info] of Object.entries(succeeded)) {
    logger.info(
      {
        ppsn,
        primaryProfileId: info.primaryProfileId,
        linkedProfileIds: info.linkedProfileIds,
      },
      "Succeeded merging profiles",
    );
  }

  logger.info("");
  logger.info(`Number of successful PPSNs: ${Object.keys(succeeded).length}`);
  logger.info("");
  logger.info("========= END SUCCEEDED PPSNs =========");
  logger.info("");
  logger.info("========= Needs Further Analysis PPSNs =========");
  logger.info("");

  for (const [ppsn, info] of Object.entries(needsFurtherAnalysis)) {
    logger.info(
      { ppsn, profileIds: info.ids, reason: info.reason },
      "Needs further analysis",
    );
  }

  logger.info("");
  logger.info(
    `Number of PPSNs that needs further analysis: ${Object.keys(needsFurtherAnalysis).length}`,
  );
  logger.info("");
  logger.info("========= END Needs Further Analysis PPSNs =========");
  logger.info("");
  logger.info("========= Not managed as expected PPSNs =========");
  logger.info("");

  for (const [ppsn, info] of Object.entries(others)) {
    logger.info({ ppsn, profileIds: info }, "Not managed as expected");
  }

  logger.info("");
  logger.info(
    `Number of PPSNs not managed as expected: ${Object.keys(others).length}`,
  );
  logger.info("");
  logger.info("========= END Not managed as expected PPSNs =========");
  logger.info("");

  logger.info("");
  logger.info("========= END RESUME =========");
}

function getErrorMessage(error: unknown): string {
  const errorObject =
    typeof error === "object" && error !== null ? error : null;
  let errorMessage = "Unknown error";
  if (errorObject) {
    if ("message" in errorObject && typeof errorObject.message === "string") {
      errorMessage = errorObject.message;
    }
    if ("detail" in errorObject && typeof errorObject.detail === "string") {
      errorMessage += ` - ${errorObject.detail}`;
    }
  }
  return errorMessage;
}
