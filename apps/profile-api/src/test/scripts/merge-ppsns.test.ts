import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pino } from "pino";
import { describe, expect, it } from "vitest";
import type { LogtoClient } from "~/clients/logto.js";
import {
  DuplicatedPPSNsErrorTypes,
  mergePpsns,
} from "~/migrations/scripts/merge-ppsns.js";
import { getPgConnection } from "~/migrations/scripts/shared.js";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import { createProfileDataForProfileDetail } from "~/services/profiles/sql/create-profile-data-for-profile-details.js";
import { createProfileDetails } from "~/services/profiles/sql/create-profile-details.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "../build-testcontainer-pg.js";

describe("mergePpsns script", async () => {
  const pool = getPoolFromConnectionString(
    process.env[DATABASE_TEST_URL_KEY] as string,
  );
  const connectionString = process.env[DATABASE_TEST_URL_KEY] as string;

  const getRandomProfileId = () => randomUUID().substring(0, 12);
  const getRandomPpsn = () => randomUUID().substring(0, 7);
  const getRandomOrgId = () => randomUUID().substring(0, 8);

  const alreadyPrimaryProfileIds = {
    first: getRandomProfileId(),
    second: getRandomProfileId(),
  };

  const helperUsersAfter = [
    {
      id: getRandomProfileId(),
      hasPrivateDetails: false,
      parentProfileId: alreadyPrimaryProfileIds.first,
    },
    {
      id: getRandomProfileId(),
      hasPrivateDetails: false,
      parentProfileId: alreadyPrimaryProfileIds.second,
    },
  ];

  const useCases: {
    label: string;
    ppsn: string;
    expectedResult: {
      success?: boolean;
      error?: { type: string };
    };
    users: {
      id: string;
      invalidCreation?: true;
      hasPrivateDetails: boolean;
      parentProfileId: string | null;
      expectedToBePrimary?: true;
    }[];
  }[] = [
    {
      label: "One with private details, one without",
      ppsn: getRandomPpsn(),
      expectedResult: { success: true },
      users: [
        {
          id: getRandomProfileId(),
          hasPrivateDetails: true,
          parentProfileId: null,
          expectedToBePrimary: true,
        },
        {
          id: getRandomProfileId(),
          hasPrivateDetails: false,
          parentProfileId: null,
        },
      ],
    },
    {
      label: "Both of them with private details",
      ppsn: getRandomPpsn(),
      expectedResult: {
        error: { type: DuplicatedPPSNsErrorTypes.LOGTO_FETCH },
      },
      users: [
        {
          id: getRandomProfileId(),
          hasPrivateDetails: true,
          parentProfileId: null,
        },
        {
          id: getRandomProfileId(),
          hasPrivateDetails: true,
          parentProfileId: null,
        },
      ],
    },
    {
      label: "One of them throws an error on getProfile",
      ppsn: getRandomPpsn(),
      expectedResult: {
        error: { type: DuplicatedPPSNsErrorTypes.FETCH_PROFILE },
      },
      users: [
        {
          id: getRandomProfileId(),
          hasPrivateDetails: true,
          invalidCreation: true,
          parentProfileId: null,
        },
        {
          id: getRandomProfileId(),
          hasPrivateDetails: true,
          parentProfileId: null,
        },
        {
          id: getRandomProfileId(),
          hasPrivateDetails: true,
          parentProfileId: null,
        },
      ],
    },
    {
      label: "Multiple profiles are already primary",
      ppsn: getRandomPpsn(),
      expectedResult: {
        error: {
          type: DuplicatedPPSNsErrorTypes.MULTIPLE_PROFILES_ALREADY_PRIMARY,
        },
      },
      users: [
        {
          id: alreadyPrimaryProfileIds.first,
          hasPrivateDetails: true,
          parentProfileId: null,
        },
        {
          id: alreadyPrimaryProfileIds.second,
          hasPrivateDetails: false,
          parentProfileId: null,
        },
      ],
    },
    {
      label: "Already linked to multiple primary profiles",
      ppsn: getRandomPpsn(),
      expectedResult: {
        error: {
          type: DuplicatedPPSNsErrorTypes.ALREADY_LINKED_TO_MULTIPLE_PRIMARY_PROFILES,
        },
      },
      users: [
        {
          id: getRandomProfileId(),
          hasPrivateDetails: true,
          parentProfileId: alreadyPrimaryProfileIds.first,
        },
        {
          id: getRandomProfileId(),
          hasPrivateDetails: false,
          parentProfileId: alreadyPrimaryProfileIds.second,
        },
        {
          id: getRandomProfileId(),
          hasPrivateDetails: false,
          parentProfileId: alreadyPrimaryProfileIds.second,
        },
      ],
    },
    {
      label: "Primary profile not in group",
      ppsn: getRandomPpsn(),
      expectedResult: {
        error: {
          type: DuplicatedPPSNsErrorTypes.PRIMARY_PROFILE_NOT_IN_GROUP,
        },
      },
      users: [
        {
          id: getRandomProfileId(),
          hasPrivateDetails: true,
          parentProfileId: alreadyPrimaryProfileIds.first,
        },
        {
          id: getRandomProfileId(),
          hasPrivateDetails: false,
          parentProfileId: null,
        },
        {
          id: getRandomProfileId(),
          hasPrivateDetails: false,
          parentProfileId: null,
        },
      ],
    },
    {
      label: "No private details across multiple profiles",
      ppsn: getRandomPpsn(),
      expectedResult: {
        error: {
          type: DuplicatedPPSNsErrorTypes.NO_PRIVATE_DETAILS,
        },
      },
      users: [
        {
          id: getRandomProfileId(),
          hasPrivateDetails: false,
          parentProfileId: null,
        },
        {
          id: getRandomProfileId(),
          hasPrivateDetails: false,
          parentProfileId: null,
        },
        {
          id: getRandomProfileId(),
          hasPrivateDetails: false,
          parentProfileId: null,
        },
      ],
    },
  ];

  const client = await pool.connect();
  try {
    for (const useCase of useCases) {
      await createTestProfiles(useCase.ppsn, client, ...useCase.users);
    }

    await createTestProfiles(getRandomPpsn(), client, ...helperUsersAfter);
  } finally {
    client.release();
  }
  const mockGetLogtoClient = async (): Promise<LogtoClient> =>
    ({}) as LogtoClient;
  const result = await mergePpsns({
    pool: getPgConnection(connectionString),
    dryRun: false,
    getLogtoClient: mockGetLogtoClient,
    logger: pino({ level: "silent" }),
  });

  expect(result).toBeDefined();
  for (const useCase of useCases) {
    it(useCase.label, () => {
      const ppsnToSearch = useCase.ppsn;
      const resultForPpsn = result?.[ppsnToSearch];
      expect(resultForPpsn, useCase.label).toBeDefined();

      if (useCase.expectedResult.success) {
        expect(resultForPpsn?.error, useCase.label).toBeUndefined();
        expect(
          resultForPpsn?.needsFurtherAnalysis,
          useCase.label,
        ).toBeUndefined();
        const expectedPrimaryId = useCase.users.find(
          (u) => u.expectedToBePrimary === true,
        )?.id;
        expect(expectedPrimaryId, useCase.label).toBeDefined();
        expect(resultForPpsn?.primaryProfileId, useCase.label).toBe(
          expectedPrimaryId,
        );
        return;
      }

      if (useCase.expectedResult.error) {
        expect(resultForPpsn?.error, useCase.label).toBeDefined();
        expect(
          resultForPpsn?.needsFurtherAnalysis,
          useCase.label,
        ).toBeUndefined();
        expect(resultForPpsn?.primaryProfileId, useCase.label).toBeUndefined();
        expect(resultForPpsn?.error?.error_type, useCase.label).toBe(
          useCase.expectedResult.error.type,
        );
        return;
      }

      throw new Error(
        `Test use case ${useCase.label} has no expected result defined`,
      );
    });
  }

  async function createTestProfiles(
    ppsn: string,
    client: PoolClient,
    ...users: {
      id: string;
      invalidCreation?: true;
      hasPrivateDetails: boolean;
      parentProfileId: string | null;
      expectedToBePrimary?: true;
    }[]
  ) {
    for (const user of users) {
      await createProfile(client, {
        id: user.id,
        publicName: `${user.id} Name`,
        email: `${user.id}@example.com`,
        primaryUserId: user.parentProfileId ? user.parentProfileId : user.id,
      });
      const orgId = user.hasPrivateDetails ? undefined : getRandomOrgId();
      const profileDetailId = await createProfileDetails(
        client,
        user.id,
        orgId,
      );
      const dataParams: Record<string, string> = {
        ppsn: ppsn,
        firstName: user.id,
        lastName: "Test",
      };

      // If we want to simulate a profile that has not been correctly created, we do not set the email
      // because it's required on getProfile
      if (!user.invalidCreation) {
        dataParams.email = `${user.id}@example.com`;
      }

      await createProfileDataForProfileDetail(
        client,
        profileDetailId,
        dataParams,
      );
    }
  }
});
