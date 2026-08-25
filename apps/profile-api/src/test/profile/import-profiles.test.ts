import { randomUUID } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";

vi.mock("~/services/profiles/create-logto-users.js");

import type { PoolClient } from "pg";
// Then imports
import { ImportStatuses } from "~/const/profile.js";
import {
  CascadeConsentReasons,
  ConsentStatuses,
  ConsentSubjects,
} from "~/schemas/consents/shared.js";
import type {
  ConsentList,
  ProfileImportDetail,
} from "~/schemas/profiles/model.js";
import { getCurrentConsentStatement } from "~/services/consent-statements/consent-statements-service.js";
import { submitConsent } from "~/services/consents/consents-service.js";
import { createLogtoUsers } from "~/services/profiles/create-logto-users.js";
import { importProfiles } from "~/services/profiles/imports/import-profiles.js";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import { createProfileDataForProfileDetail } from "~/services/profiles/sql/create-profile-data-for-profile-details.js";
import { createProfileDetails } from "~/services/profiles/sql/create-profile-details.js";
import { createProfileImport } from "~/services/profiles/sql/create-profile-import.js";
import { createProfileImportDetails } from "~/services/profiles/sql/create-profile-import-details.js";
import { findProfileWithData } from "~/services/profiles/sql/find-profile-with-data.js";
import { mockLogger, mockLogtoConfig } from "~/test/fixtures/common.js";
import { getOrgAnalyticsSdk } from "~/utils/authentication-factory.js";

describe("importProfiles", () => {
  const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
  let client: PoolClient;

  beforeEach(async () => {
    client = await pool.connect();
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (client) {
      client.release();
    }
  });

  afterAll(() => {
    if (!pool.ended) {
      pool.end();
    }
  });

  const buildMockProfileImportDetail = () => ({
    email: `${randomUUID().substring(0, 8)}@example.com`,
    firstName: randomUUID().substring(0, 8),
    lastName: randomUUID().substring(0, 8),
    phone: randomUUID().substring(0, 8),
    dateOfBirth: new Date(
      Date.now() - Math.floor(Math.random() * 1000000),
    ).toISOString(),
    address: randomUUID().substring(0, 10),
    city: randomUUID().substring(0, 6),
    externalId: randomUUID().substring(0, 10),
    ppsn: randomUUID().substring(0, 5).toUpperCase(),
    id: randomUUID() as string,
    status: ImportStatuses.PENDING,
    batch: Math.floor(Math.random() * 100),
  });

  const getSampleProfile = (isChild?: boolean) => {
    const id = randomUUID().substring(0, 12);
    return {
      id,
      publicName: `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
      email: `${randomUUID().substring(0, 5)}@example.com`,
      primaryUserId: isChild ? randomUUID().substring(0, 12) : id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      preferredLanguage:
        Math.random() > 0.5 ? "en" : ("ga" as "en" | "ga" | undefined),
      details: {
        firstName: randomUUID().substring(0, 5),
        lastName: randomUUID().substring(0, 5),
        email: `${randomUUID().substring(0, 5)}@example.com`,
        phone: randomUUID().substring(0, 5),
        dateOfBirth: new Date(
          Date.now() - Math.floor(Math.random() * 1000000),
        ).toISOString(),
        address: randomUUID().substring(0, 10),
        city: randomUUID().substring(0, 6),
        ppsn: randomUUID().substring(0, 5).toUpperCase(),
      },
    };
  };

  it("should successfully import new profiles", async () => {
    const orgId = randomUUID().substring(0, 11);
    const profileImport = await createProfileImport(client, orgId);

    const mockProfileImportDetails = [
      buildMockProfileImportDetail(),
      buildMockProfileImportDetail(),
    ];

    const importIds = await createProfileImportDetails(
      client,
      profileImport.profileImportId,
      mockProfileImportDetails,
    );

    mockProfileImportDetails[0].id = importIds[0];
    mockProfileImportDetails[1].id = importIds[1];
    (createLogtoUsers as Mock).mockReturnValue([
      {
        id: randomUUID().substring(0, 12),
        primaryEmail: mockProfileImportDetails[0].email,
      },
      {
        id: randomUUID().substring(0, 12),
        primaryEmail: mockProfileImportDetails[1].email,
      },
    ]);

    const result = await importProfiles({
      pool,
      logger: mockLogger as unknown as FastifyBaseLogger,
      profileImportDetails: mockProfileImportDetails,
      organizationId: orgId,
      config: mockLogtoConfig,
      profileImportId: profileImport.profileImportId,
      insertPrivateDetails: false,
      onlyPrivateDetails: false,
      analyticsSdk: await getOrgAnalyticsSdk(
        mockLogtoConfig,
        mockLogger,
        orgId,
      ),
    });

    expect(createLogtoUsers).toHaveBeenCalled();
    // Pending because Logto still needs to invoke webhook
    expect(result).toStrictEqual({
      status: ImportStatuses.PENDING,
      profileImportId: profileImport.profileImportId,
    });

    const firstProfileDetailsAfter = await client.query<{
      organisation_id: string;
      created_at: Date;
    }>(
      `
      SELECT organisation_id, created_at from profile_details where profile_id = $1 and organisation_id = $2
    `,
      [mockProfileImportDetails[0].id, orgId],
    );

    // it must not have been imported yet because
    // details must be added after logto invoked webhook
    expect(firstProfileDetailsAfter.rows).toHaveLength(0);
  });

  it("should successfully manage already existent profiles", async () => {
    const orgId = randomUUID().substring(0, 11);

    // first profile exists and has already
    // been imported by same org
    const firstProfile = getSampleProfile();
    await createProfile(client, firstProfile);
    const firstProfileDetailId = await createProfileDetails(
      client,
      firstProfile.id,
      orgId,
    );
    await createProfileDataForProfileDetail(
      client,
      firstProfileDetailId,
      firstProfile.details,
    );

    // second profile exists and has already
    // been imported by ANOTHER org
    const secondProfile = getSampleProfile();
    await createProfile(client, secondProfile);
    const anotherOrgId = randomUUID().substring(0, 11);
    const secondProfileDetailId = await createProfileDetails(
      client,
      secondProfile.id,
      anotherOrgId,
    );
    await createProfileDataForProfileDetail(
      client,
      secondProfileDetailId,
      secondProfile.details,
    );
    const profileImport = await createProfileImport(client, orgId);

    const firstImportDetail = buildMockProfileImportDetail();
    firstImportDetail.email = firstProfile.email;
    firstImportDetail.ppsn = firstProfile.details.ppsn;

    const secondImportDetail = buildMockProfileImportDetail();
    secondImportDetail.email = secondProfile.email;
    secondImportDetail.ppsn = secondProfile.details.ppsn;

    const thirdImportDetail = buildMockProfileImportDetail();
    const mockProfileImportDetails = [
      firstImportDetail,
      secondImportDetail,
      thirdImportDetail,
    ];
    const importIds = await createProfileImportDetails(
      client,
      profileImport.profileImportId,
      mockProfileImportDetails,
    );

    firstImportDetail.id = importIds[0];
    secondImportDetail.id = importIds[1];
    thirdImportDetail.id = importIds[2];
    (createLogtoUsers as Mock).mockReturnValue([
      {
        id: randomUUID().substring(0, 12),
        primaryEmail: thirdImportDetail.email,
      },
    ]);

    const result = await importProfiles({
      pool,
      logger: mockLogger as unknown as FastifyBaseLogger,
      profileImportDetails: mockProfileImportDetails,
      organizationId: orgId,
      config: mockLogtoConfig,
      profileImportId: profileImport.profileImportId,
      insertPrivateDetails: false,
      onlyPrivateDetails: false,
      analyticsSdk: await getOrgAnalyticsSdk(
        mockLogtoConfig,
        mockLogger,
        orgId,
      ),
    });

    // because third one does not exist yet
    expect(createLogtoUsers).toHaveBeenCalled();
    expect(result).toStrictEqual({
      status: ImportStatuses.PENDING,
      profileImportId: profileImport.profileImportId,
    });

    const firstProfileDetailsAfter = await client.query<{
      organisation_id: string;
      created_at: Date;
    }>(
      `
      SELECT organisation_id, created_at from profile_details where profile_id = $1 and organisation_id = $2
    `,
      [firstProfile.id, orgId],
    );

    // 1 created before, 1 after import
    expect(firstProfileDetailsAfter.rows).toHaveLength(2);

    // Get the latest one, must be the one we've imported
    const withDataFirstProfile = await findProfileWithData(
      client,
      orgId,
      firstProfile.id,
      [],
    );
    expect(withDataFirstProfile?.details?.firstName.value).toBe(
      firstImportDetail.firstName,
    );
    expect(withDataFirstProfile?.details?.lastName.value).toBe(
      firstImportDetail.lastName,
    );
    expect(withDataFirstProfile?.details?.email.value).toBe(
      firstImportDetail.email,
    );

    const secondProfileDetailsAfter = await client.query<{
      organisation_id: string;
      created_at: Date;
    }>(
      `
      SELECT organisation_id, created_at from profile_details where profile_id = $1 and organisation_id = $2
    `,
      [secondProfile.id, orgId],
    );

    // 1 after import for the new org
    expect(secondProfileDetailsAfter.rows).toHaveLength(1);

    // Get the latest one, must be the one we've imported
    const withDataSecondProfile = await findProfileWithData(
      client,
      orgId,
      secondProfile.id,
      [],
    );
    expect(withDataSecondProfile?.details?.firstName.value).toBe(
      secondImportDetail.firstName,
    );
    expect(withDataSecondProfile?.details?.lastName.value).toBe(
      secondImportDetail.lastName,
    );
    expect(withDataSecondProfile?.details?.email.value).toBe(
      secondImportDetail.email,
    );
  });

  it("should manage empty import details input", async () => {
    const orgId = randomUUID().substring(0, 11);
    const profileImport = await createProfileImport(client, orgId);

    const mockProfileImportDetails: ProfileImportDetail[] = [];

    const result = await importProfiles({
      pool,
      logger: mockLogger as unknown as FastifyBaseLogger,
      profileImportDetails: mockProfileImportDetails,
      organizationId: orgId,
      config: mockLogtoConfig,
      profileImportId: profileImport.profileImportId,
      insertPrivateDetails: false,
      onlyPrivateDetails: false,
      analyticsSdk: await getOrgAnalyticsSdk(
        mockLogtoConfig,
        mockLogger,
        orgId,
      ),
    });

    expect(createLogtoUsers).not.toHaveBeenCalled();

    expect(result).toStrictEqual({
      status: ImportStatuses.COMPLETED,
      profileImportId: profileImport.profileImportId,
    });
  });

  it("should create private details if they do not exist", async () => {
    const orgId = randomUUID().substring(0, 11);

    // first profile exists and has already
    // been imported by same org
    const firstProfile = getSampleProfile();
    await createProfile(client, firstProfile);
    const firstProfileDetailId = await createProfileDetails(
      client,
      firstProfile.id,
      orgId,
    );
    await createProfileDataForProfileDetail(
      client,
      firstProfileDetailId,
      firstProfile.details,
    );

    const profileImport = await createProfileImport(client, orgId);

    const firstImportDetail = buildMockProfileImportDetail();
    firstImportDetail.email = firstProfile.email;
    firstImportDetail.ppsn = firstProfile.details.ppsn;

    const detailsOnDb = await createProfileImportDetails(
      client,
      profileImport.profileImportId,
      [firstImportDetail],
    );

    firstImportDetail.id = detailsOnDb[0];

    const result = await importProfiles({
      pool,
      logger: mockLogger as unknown as FastifyBaseLogger,
      profileImportDetails: [firstImportDetail],
      organizationId: orgId,
      config: mockLogtoConfig,
      profileImportId: profileImport.profileImportId,
      insertPrivateDetails: true,
      onlyPrivateDetails: false,
      analyticsSdk: await getOrgAnalyticsSdk(
        mockLogtoConfig,
        mockLogger,
        orgId,
      ),
    });

    expect(createLogtoUsers).not.toHaveBeenCalled();
    expect(result).toStrictEqual({
      status: ImportStatuses.COMPLETED,
      profileImportId: profileImport.profileImportId,
    });

    // Get the latest private one, must be the one we've imported
    const withDataPrivate = await findProfileWithData(
      client,
      undefined,
      firstProfile.id,
      [],
    );
    expect(withDataPrivate?.details?.firstName.value).toBe(
      firstImportDetail.firstName,
    );
    expect(withDataPrivate?.details?.lastName.value).toBe(
      firstImportDetail.lastName,
    );
    expect(withDataPrivate?.details?.email.value).toBe(firstImportDetail.email);

    // Get the latest org one, must be the one we've imported
    const withDataOrg = await findProfileWithData(
      client,
      orgId,
      firstProfile.id,
      [],
    );
    expect(withDataOrg?.details?.firstName.value).toBe(
      firstImportDetail.firstName,
    );
    expect(withDataOrg?.details?.lastName.value).toBe(
      firstImportDetail.lastName,
    );
    expect(withDataOrg?.details?.email.value).toBe(firstImportDetail.email);
  });

  it("should create private details ONLY if they do not exist and onlyPrivateDetails is true", async () => {
    const orgId = randomUUID().substring(0, 11);

    // first profile exists and has already
    // been imported by same org
    const firstProfile = getSampleProfile();
    await createProfile(client, firstProfile);
    const firstProfileDetailId = await createProfileDetails(
      client,
      firstProfile.id,
      orgId,
    );
    await createProfileDataForProfileDetail(
      client,
      firstProfileDetailId,
      firstProfile.details,
    );

    const profileImport = await createProfileImport(client, orgId);

    const firstImportDetail = buildMockProfileImportDetail();
    firstImportDetail.email = firstProfile.email;
    firstImportDetail.ppsn = firstProfile.details.ppsn;

    const detailIds = await createProfileImportDetails(
      client,
      profileImport.profileImportId,
      [firstImportDetail],
    );

    firstImportDetail.id = detailIds[0];

    const result = await importProfiles({
      pool,
      logger: mockLogger as unknown as FastifyBaseLogger,
      profileImportDetails: [firstImportDetail],
      organizationId: orgId,
      config: mockLogtoConfig,
      profileImportId: profileImport.profileImportId,
      insertPrivateDetails: true,
      onlyPrivateDetails: true,
      analyticsSdk: await getOrgAnalyticsSdk(
        mockLogtoConfig,
        mockLogger,
        orgId,
      ),
    });

    expect(createLogtoUsers).not.toHaveBeenCalled();

    expect(result).toStrictEqual({
      status: ImportStatuses.COMPLETED,
      profileImportId: profileImport.profileImportId,
    });

    // Get the latest private one, must be the one we've imported
    const withDataFirstProfile = await findProfileWithData(
      client,
      undefined,
      firstProfile.id,
      [],
    );
    expect(withDataFirstProfile?.details?.firstName.value).toBe(
      firstImportDetail.firstName,
    );
    expect(withDataFirstProfile?.details?.lastName.value).toBe(
      firstImportDetail.lastName,
    );
    expect(withDataFirstProfile?.details?.email.value).toBe(
      firstImportDetail.email,
    );

    // Get the latest org one, must be the one that we
    // created before import
    const withDataOrg = await findProfileWithData(
      client,
      orgId,
      firstProfile.id,
      [],
    );

    expect(withDataOrg?.details?.firstName.value).toBe(
      firstProfile.details.firstName,
    );
    expect(withDataOrg?.details?.lastName.value).toBe(
      firstProfile.details.lastName,
    );
    expect(withDataOrg?.details?.email.value).toBe(firstProfile.details.email);
  });

  it("should manage errors as expected", async () => {
    const orgId = randomUUID().substring(0, 11);
    const profileImport = await createProfileImport(client, orgId);

    const mockProfileImportDetails = [buildMockProfileImportDetail()];

    const detailIds = await createProfileImportDetails(
      client,
      profileImport.profileImportId,
      mockProfileImportDetails,
    );

    mockProfileImportDetails[0].id = detailIds[0];

    const logtoError = new Error("Logto error");
    (createLogtoUsers as Mock).mockRejectedValue(logtoError);

    const result = await importProfiles({
      pool,
      logger: mockLogger as unknown as FastifyBaseLogger,
      profileImportDetails: mockProfileImportDetails,
      organizationId: orgId,
      config: mockLogtoConfig,
      profileImportId: profileImport.profileImportId,
      insertPrivateDetails: false,
      onlyPrivateDetails: false,
      analyticsSdk: await getOrgAnalyticsSdk(
        mockLogtoConfig,
        mockLogger,
        orgId,
      ),
    });

    expect(createLogtoUsers).toHaveBeenCalled();
    expect(result).toStrictEqual({
      status: ImportStatuses.FAILED,
      profileImportId: profileImport.profileImportId,
    });

    const detailFromDb = await client.query<{ status: string }>(
      `
      SELECT status FROM profile_import_details
    WHERE profile_import_id = $1 `,
      [profileImport.profileImportId],
    );

    expect(detailFromDb.rows).toHaveLength(1);
    expect(detailFromDb.rows[0].status).toBe(ImportStatuses.FAILED);
  });

  it("should successfully manage already existent profiles with empty consent statuses", async () => {
    const orgId = randomUUID().substring(0, 11);

    // first profile exists and has already
    // been imported by same org
    const firstProfile = getSampleProfile();
    await createProfile(client, firstProfile);
    const firstProfileDetailId = await createProfileDetails(
      client,
      firstProfile.id,
      orgId,
    );
    await createProfileDataForProfileDetail(
      client,
      firstProfileDetailId,
      firstProfile.details,
    );

    // second profile exists and has already
    // been imported by ANOTHER org
    const secondProfile = getSampleProfile();
    await createProfile(client, secondProfile);
    const anotherOrgId = randomUUID().substring(0, 11);
    const secondProfileDetailId = await createProfileDetails(
      client,
      secondProfile.id,
      anotherOrgId,
    );
    await createProfileDataForProfileDetail(
      client,
      secondProfileDetailId,
      secondProfile.details,
    );
    // Second profile already has consent
    const consentStatement = await getCurrentConsentStatement({
      subject: ConsentSubjects.Messaging,
      client,
    });
    await submitConsent({
      consentInput: {
        subject: ConsentSubjects.Messaging,
        consentStatementId: consentStatement.id,
        status: ConsentStatuses.OptedIn,
      },
      client,
      userId: secondProfile.id,
      logger: mockLogger,
      reason: CascadeConsentReasons.ExplicitSubmission,
    });

    // third profile is a child, so submitConsent must not be invoked for it
    const thirdProfile = getSampleProfile(true);
    await createProfile(client, thirdProfile);
    const thirdProfileDetailId = await createProfileDetails(
      client,
      thirdProfile.id,
      orgId,
    );
    await createProfileDataForProfileDetail(
      client,
      thirdProfileDetailId,
      thirdProfile.details,
    );
    await createProfileDataForProfileDetail(
      client,
      thirdProfileDetailId,
      thirdProfile.details,
    );

    const profileImport = await createProfileImport(client, orgId);

    const firstImportDetail = buildMockProfileImportDetail();
    firstImportDetail.email = firstProfile.email;
    firstImportDetail.ppsn = firstProfile.details.ppsn;

    const secondImportDetail = buildMockProfileImportDetail();
    secondImportDetail.email = secondProfile.email;
    secondImportDetail.ppsn = secondProfile.details.ppsn;

    const thirdImportDetail = buildMockProfileImportDetail();
    thirdImportDetail.email = thirdProfile.email;
    thirdImportDetail.ppsn = thirdProfile.details.ppsn;

    const mockProfileImportDetails = [
      firstImportDetail,
      secondImportDetail,
      thirdImportDetail,
    ];
    const importIds = await createProfileImportDetails(
      client,
      profileImport.profileImportId,
      mockProfileImportDetails,
    );

    firstImportDetail.id = importIds[0];
    secondImportDetail.id = importIds[1];
    thirdImportDetail.id = importIds[2];

    const result = await importProfiles({
      pool,
      logger: mockLogger as unknown as FastifyBaseLogger,
      profileImportDetails: mockProfileImportDetails,
      organizationId: orgId,
      config: mockLogtoConfig,
      profileImportId: profileImport.profileImportId,
      insertPrivateDetails: false,
      onlyPrivateDetails: false,
      analyticsSdk: await getOrgAnalyticsSdk(
        mockLogtoConfig,
        mockLogger,
        orgId,
      ),
    });

    expect(result).toStrictEqual({
      status: ImportStatuses.COMPLETED,
      profileImportId: profileImport.profileImportId,
    });

    const firstProfileConsentStatusesAfter = await client.query<{
      consent_statuses: ConsentList | null;
    }>(
      `
      SELECT consent_statuses from profiles where id = $1
    `,
      [firstProfile.id],
    );

    expect(firstProfileConsentStatusesAfter.rows).toHaveLength(1);
    expect(
      firstProfileConsentStatusesAfter.rows[0].consent_statuses,
    ).not.toBeNull();
    expect(
      firstProfileConsentStatusesAfter.rows[0].consent_statuses?.messaging,
    ).not.toBeNull();
    expect(
      firstProfileConsentStatusesAfter.rows[0].consent_statuses?.messaging
        .consent_statement_id,
    ).toStrictEqual(consentStatement.id);
    expect(
      firstProfileConsentStatusesAfter.rows[0].consent_statuses?.messaging
        .status,
    ).toStrictEqual(ConsentStatuses.PreApproved);

    const secondProfileConsentStatusesAfter = await client.query<{
      consent_statuses: ConsentList | null;
    }>(
      `
      SELECT consent_statuses from profiles where id = $1
    `,
      [secondProfile.id],
    );

    expect(secondProfileConsentStatusesAfter.rows).toHaveLength(1);
    expect(
      secondProfileConsentStatusesAfter.rows[0].consent_statuses,
    ).not.toBeNull();
    expect(
      secondProfileConsentStatusesAfter.rows[0].consent_statuses?.messaging,
    ).not.toBeNull();
    expect(
      secondProfileConsentStatusesAfter.rows[0].consent_statuses?.messaging
        .consent_statement_id,
    ).toStrictEqual(consentStatement.id);
    // We set opted in before
    expect(
      secondProfileConsentStatusesAfter.rows[0].consent_statuses?.messaging
        .status,
    ).toStrictEqual(ConsentStatuses.OptedIn);

    const thirdProfileConsentStatusesAfter = await client.query<{
      consent_statuses: ConsentList | null;
    }>(
      `
      SELECT consent_statuses from profiles where id = $1
    `,
      [thirdProfile.id],
    );

    expect(thirdProfileConsentStatusesAfter.rows).toHaveLength(1);
    expect(
      thirdProfileConsentStatusesAfter.rows[0].consent_statuses,
    ).toBeNull();
  });

  it("should only match profile data if it's the latest", async () => {
    const orgId = randomUUID().substring(0, 11);

    // first profile exists and has already
    // been imported by the user
    const firstProfile = getSampleProfile();
    await createProfile(client, firstProfile);
    const firstProfileDetailId = await createProfileDetails(
      client,
      firstProfile.id,
      undefined,
    );
    await createProfileDataForProfileDetail(
      client,
      firstProfileDetailId,
      firstProfile.details,
    );
    const oldEmail = firstProfile.details.email;

    const updateResult = await client.query(
      "UPDATE profile_details SET is_latest = false WHERE id = $1 RETURNING id",
      [firstProfileDetailId],
    );
    expect(updateResult.rows).toHaveLength(1);
    expect(updateResult.rows[0].id).toBe(firstProfileDetailId);

    // Create a new profile detail with different email
    const latestEmail = `latest-${randomUUID().substring(0, 5)}@example.com`;
    const latestProfileDetailId = await createProfileDetails(
      client,
      firstProfile.id,
      undefined,
    );
    await createProfileDataForProfileDetail(client, latestProfileDetailId, {
      ...firstProfile.details,
      email: latestEmail,
    });

    const profileImport = await createProfileImport(client, orgId);

    const firstImportDetail = buildMockProfileImportDetail();
    // using OLD email to import
    firstImportDetail.email = oldEmail;
    firstImportDetail.ppsn = firstProfile.details.ppsn;

    const mockProfileImportDetails = [firstImportDetail];
    const importIds = await createProfileImportDetails(
      client,
      profileImport.profileImportId,
      mockProfileImportDetails,
    );

    firstImportDetail.id = importIds[0];

    (createLogtoUsers as Mock).mockReturnValue([
      {
        id: randomUUID().substring(0, 12),
        primaryEmail: firstImportDetail.email,
      },
    ]);

    const result = await importProfiles({
      pool,
      logger: mockLogger as unknown as FastifyBaseLogger,
      profileImportDetails: mockProfileImportDetails,
      organizationId: orgId,
      config: mockLogtoConfig,
      profileImportId: profileImport.profileImportId,
      insertPrivateDetails: false,
      onlyPrivateDetails: false,
      analyticsSdk: await getOrgAnalyticsSdk(
        mockLogtoConfig,
        mockLogger,
        orgId,
      ),
    });

    // User must be created because email did not match latest profile data
    expect(createLogtoUsers).toHaveBeenCalled();
    // Pending because Logto still needs to invoke webhook
    expect(result).toStrictEqual({
      status: ImportStatuses.PENDING,
      profileImportId: profileImport.profileImportId,
    });

    const firstProfileDetailsAfter = await client.query<{
      organisation_id: string;
      created_at: Date;
    }>(
      `
      SELECT organisation_id, created_at from profile_details where profile_id = $1 and organisation_id = $2
    `,
      [firstProfile.id, orgId],
    );

    // it must not have been imported yet because
    // details must be added after logto invoked webhook
    expect(firstProfileDetailsAfter.rows).toHaveLength(0);

    // -------------------------
    // Now test with latest email
    const latestProfileImport = await createProfileImport(client, orgId);

    const latestProfileImportDetail = buildMockProfileImportDetail();
    // using Latest email to import
    // adding toUpperCase to ensure it's not case sensitive
    latestProfileImportDetail.email = latestEmail.toUpperCase();
    latestProfileImportDetail.ppsn = firstProfile.details.ppsn;

    const mockLatestProfileImportDetails = [latestProfileImportDetail];
    const latestImportIds = await createProfileImportDetails(
      client,
      latestProfileImport.profileImportId,
      mockLatestProfileImportDetails,
    );

    latestProfileImportDetail.id = latestImportIds[0];

    const latestResult = await importProfiles({
      pool,
      logger: mockLogger as unknown as FastifyBaseLogger,
      profileImportDetails: mockLatestProfileImportDetails,
      organizationId: orgId,
      config: mockLogtoConfig,
      profileImportId: latestProfileImport.profileImportId,
      insertPrivateDetails: false,
      onlyPrivateDetails: false,
      analyticsSdk: await getOrgAnalyticsSdk(
        mockLogtoConfig,
        mockLogger,
        orgId,
      ),
    });

    // Completed because Logto is not needed
    expect(latestResult).toStrictEqual({
      status: ImportStatuses.COMPLETED,
      profileImportId: latestProfileImport.profileImportId,
    });

    const latestProfileDetailsAfter = await client.query<{
      organisation_id: string;
      created_at: Date;
    }>(
      `
      SELECT organisation_id, created_at from profile_details where profile_id = $1 and organisation_id = $2
    `,
      [firstProfile.id, orgId],
    );

    expect(latestProfileDetailsAfter.rows).toHaveLength(1);

    const withDataFirstProfile = await findProfileWithData(
      client,
      orgId,
      firstProfile.id,
      [],
    );
    expect(withDataFirstProfile?.details?.firstName.value).toBe(
      latestProfileImportDetail.firstName,
    );
    expect(withDataFirstProfile?.details?.lastName.value).toBe(
      latestProfileImportDetail.lastName,
    );
    expect(withDataFirstProfile?.details?.email.value).toBe(
      latestProfileImportDetail.email,
    );
    // findProfileWithData returns the root email, not the
    // one in profile data
    expect(withDataFirstProfile?.email).toBe(firstProfile.email);
  });
});
