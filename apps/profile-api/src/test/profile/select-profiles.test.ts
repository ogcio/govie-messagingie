import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import {
  CascadeConsentReasons,
  ConsentStatuses,
  ConsentSubjects,
} from "~/schemas/consents/shared.js";
import { getCurrentConsentStatement } from "~/services/consent-statements/consent-statements-service.js";
import { submitConsent } from "~/services/consents/consents-service.js";
import { selectProfiles } from "~/services/profiles/select-profiles.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "../build-testcontainer-pg.js";
import { mockLogger } from "../fixtures/common.js";

const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
const organisationId = randomUUID().substring(0, 9);

async function createProfileWithDetails({
  id = randomUUID().substring(0, 12),
  detailsId = randomUUID(),
  firstName = randomUUID().substring(0, 8),
  lastName = randomUUID().substring(0, 8),
  publicName = "",
  ppsn = randomUUID().substring(0, 7),
  email = `${randomUUID().substring(0, 8)}@mail.com`,
  active = true,
  setLatestDetail = true,
} = {}) {
  await pool.query(
    `INSERT INTO profiles (id, public_name, email, primary_user_id, created_at, updated_at, preferred_language, deleted_at)
     VALUES ($1, $2, $3, $1, NOW(), NOW(), 'en', ${active ? "NULL" : "NOW()"})`,
    [id, publicName || `${firstName} ${lastName}`, email],
  );

  await createDetailsAndDataForProfile({
    detailsId,
    profileId: id,
    firstName,
    lastName,
    email,
    ppsn,
    setLatestDetail,
  });

  return { id, firstName, lastName, email, ppsn, detailsId };
}

async function createDetailsAndDataForProfile(params: {
  setLatestDetail: boolean;
  detailsId: string;
  profileId: string;
  firstName: string;
  lastName: string;
  email: string;
  ppsn: string;
}) {
  await pool.query(
    `INSERT INTO profile_details (id, profile_id, organisation_id, is_latest)
     VALUES ($1, $2, $3, $4)`,
    [
      params.detailsId,
      params.profileId,
      organisationId,
      params.setLatestDetail,
    ],
  );

  const { firstName, lastName, email, ppsn } = params;
  for (const [name, value] of Object.entries({
    firstName,
    lastName,
    ppsn,
    email,
  })) {
    await pool.query(
      `INSERT INTO profile_data (profile_details_id, name, value, value_type)
       VALUES ($1, $2, $3, 'string')`,
      [params.detailsId, name, value],
    );
  }
}

describe("selectProfiles", () => {
  afterAll(async () => {
    if (!pool.ended) {
      await pool.end();
    }
  });

  it("should return empty array when no profiles found", async () => {
    const result = await selectProfiles({
      pool,
      organizationId: "org-123",
      profileIds: ["nonexistent-1", "nonexistent-2"],
      consentSubjects: [],
    });

    expect(result).toEqual([]);
  });

  it("should return the correct user when profile found", async () => {
    const profile = await createProfileWithDetails();
    const result = await selectProfiles({
      pool,
      organizationId: organisationId,
      profileIds: [profile.id],
      consentSubjects: [],
    });

    expect(result.length).toEqual(1);
    expect(result[0].id).toEqual(profile.id);
    expect(result[0].details?.firstName).toEqual(profile.firstName);
    expect(result[0].details?.lastName).toEqual(profile.lastName);
    expect(result[0].details?.email).toEqual(profile.email);
    expect(result[0].details?.ppsn).toEqual(profile.ppsn);
    expect(result[0].email).toEqual(profile.email);
    expect(result[0].publicName).toBeDefined();
  });

  it("should return multiple users when profiles found", async () => {
    const profile = await createProfileWithDetails();
    const profile2 = await createProfileWithDetails();

    const result = await selectProfiles({
      pool,
      organizationId: organisationId,
      profileIds: [profile.id, profile2.id],
      consentSubjects: [],
    });

    expect(result.length).toEqual(2);
    const ids = result.map((p) => p.id);
    expect(ids).toContain(profile.id);
    expect(ids).toContain(profile2.id);
  });

  it("should return latest imported email", async () => {
    const profile = await createProfileWithDetails({ setLatestDetail: false });
    const secondEmail = `${randomUUID().substring(0, 8)}@mail.com`;
    await createDetailsAndDataForProfile({
      detailsId: randomUUID(),
      profileId: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: secondEmail,
      ppsn: profile.ppsn,
      setLatestDetail: true,
    });

    const result = await selectProfiles({
      pool,
      organizationId: organisationId,
      profileIds: [profile.id],
      consentSubjects: [],
    });

    expect(result.length).toEqual(1);
    expect(result[0].id).toEqual(profile.id);
    expect(result[0].details?.email).toEqual(secondEmail);
    expect(result[0].email).toEqual(secondEmail);
  });

  it("should return consent subject", async () => {
    const profile = await createProfileWithDetails();
    const { id: consentStatementId } = await getCurrentConsentStatement({
      subject: ConsentSubjects.Messaging,
      pool,
    });
    await submitConsent({
      logger: mockLogger,
      pool,
      userId: profile.id,
      consentInput: {
        subject: ConsentSubjects.Messaging,
        status: ConsentStatuses.OptedIn,
        consentStatementId,
      },
      reason: CascadeConsentReasons.FirstImport,
    });

    const withoutResult = await selectProfiles({
      pool,
      organizationId: organisationId,
      profileIds: [profile.id],
      consentSubjects: [],
    });

    // In this case consent status must be null
    // even if set on db because we didn't
    // include consentSubjects in params
    expect(withoutResult[0].consentStatuses).toBeNull();

    const result = await selectProfiles({
      pool,
      organizationId: organisationId,
      profileIds: [profile.id],
      consentSubjects: [ConsentSubjects.Messaging],
    });

    expect(result[0].consentStatuses).not.toBeNull();
    expect(result[0].consentStatuses?.messaging).toBeDefined();
    expect(result[0].consentStatuses).toEqual({
      messaging: {
        status: ConsentStatuses.OptedIn,
        consent_statement_id: consentStatementId,
      },
    });
  });

  it("should handle database errors", async () => {
    // passing invalid organisationId to trigger db error
    await expect(
      selectProfiles({
        pool,
        organizationId: { notValid: "as-string" } as unknown as string,
        profileIds: ["some-id"],
        consentSubjects: 123468 as unknown as string[],
      }),
    ).rejects.toThrow();
  });
});
