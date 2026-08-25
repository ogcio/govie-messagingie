import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CascadeConsentReasons,
  ConsentStatuses,
  ConsentSubjects,
} from "~/schemas/consents/shared.js";
import type { ProfileWithDetails } from "~/schemas/profiles/model.js";
import { getCurrentConsentStatement } from "~/services/consent-statements/consent-statements-service.js";
import { submitConsent } from "~/services/consents/consents-service.js";
import { listProfiles } from "~/services/profiles/list-profiles.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { mockLogger } from "~/test/fixtures/common.js";

const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
const organisationId = "list-profiles-org-123";
const defaultPagination = { offset: "0", limit: "10" };

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

describe("listProfiles (Postgres TestContainer)", () => {
  beforeAll(async () => {
    // Optionally, run migrations or setup here
  });

  afterAll(async () => {
    if (!pool.ended) {
      await pool.end();
    }
  });

  it("should list profiles with pagination", async () => {
    const p1 = await createProfileWithDetails({
      id: randomUUID().substring(0, 12),
      detailsId: randomUUID(),
    });
    const p2 = await createProfileWithDetails({
      id: randomUUID().substring(0, 12),
      detailsId: randomUUID(),
      firstName: "Another",
      email: "e2@mail.com",
    });

    const result = await listProfiles({
      pool,
      organisationId,
      pagination: defaultPagination,
      consentSubjects: [],
    });
    const map: Record<string, ProfileWithDetails> = {};
    const ids = new Set<string>();
    for (const profile of result.data) {
      map[profile.id] = profile;
      ids.add(profile.id);
    }
    expect(ids).toContain(p1.id);
    expect(ids).toContain(p2.id);
  });

  it("should list profiles with search", async () => {
    const p = await createProfileWithDetails({
      id: randomUUID().substring(0, 12),
      detailsId: randomUUID(),
      firstName: randomUUID().substring(0, 8),
      lastName: randomUUID().substring(0, 8),
      email: `${randomUUID().substring(0, 8)}@mail.com`,
    });

    const result = await listProfiles({
      pool,
      organisationId,
      pagination: defaultPagination,
      searchParams: { search: p.firstName },
      consentSubjects: [],
    });

    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(result.data[0].details?.firstName).toBe(p.firstName);
    expect(result.total).toBeGreaterThanOrEqual(1);
  });

  it("should list profiles with search and field filters", async () => {
    const p = await createProfileWithDetails({
      id: randomUUID().substring(0, 12),
      detailsId: randomUUID(),
      firstName: randomUUID().substring(0, 8),
      lastName: randomUUID().substring(0, 8),
      email: `${randomUUID().substring(0, 8)}@mail.com`,
    });

    const result = await listProfiles({
      pool,
      organisationId,
      pagination: defaultPagination,
      searchParams: {
        search: p.firstName,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
      },
      consentSubjects: [],
    });

    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(result.data.map((p) => p.id)).toContain(p.id);
    expect(result.total).toBeGreaterThanOrEqual(1);
  });

  it("should list profiles with first name field filter matching public name", async () => {
    const publicName = "Banarne Banan";
    const p = await createProfileWithDetails({
      publicName,
    });

    const result = await listProfiles({
      pool,
      organisationId,
      pagination: defaultPagination,
      searchParams: {
        firstName: "Banan",
      },
      consentSubjects: [],
    });

    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(result.data.map((p) => p.id)).toContain(p.id);
    expect(result.total).toBeGreaterThanOrEqual(1);
  });

  it("should list profiles with last name field filter matching public name", async () => {
    const publicName = "Hojaren Skojaren";
    const p = await createProfileWithDetails({
      publicName,
    });

    const result = await listProfiles({
      pool,
      organisationId,
      pagination: defaultPagination,
      searchParams: {
        lastName: "Skoj",
      },
      consentSubjects: [],
    });

    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(result.data.map((p) => p.id)).toContain(p.id);
    expect(result.total).toBeGreaterThanOrEqual(1);
  });

  it("should list active profiles only", async () => {
    const p1 = await createProfileWithDetails({});
    const p2 = await createProfileWithDetails({ active: false });

    const result = await listProfiles({
      pool,
      organisationId,
      pagination: defaultPagination,
      activeOnly: true,
      consentSubjects: [],
    });

    expect(result.data.length).toBeGreaterThanOrEqual(1);
    const ids = result.data.map((p) => p.id);
    expect(ids).toContain(p1.id);
    expect(ids).not.toContain(p2.id);
  });

  it("should handle empty results", async () => {
    const result = await listProfiles({
      pool,
      organisationId,
      pagination: defaultPagination,
      searchParams: {
        search: `${randomUUID()}123`,
      },
      consentSubjects: [],
    });

    expect(result).toEqual({
      data: [],
      total: 0,
    });
  });

  it("should list profiles with consent status", async () => {
    const p = await createProfileWithDetails({
      id: randomUUID().substring(0, 12),
      detailsId: randomUUID(),
      firstName: randomUUID().substring(0, 8),
      lastName: randomUUID().substring(0, 8),
      email: `${randomUUID().substring(0, 8)}@mail.com`,
    });
    const { id: consentStatementId } = await getCurrentConsentStatement({
      subject: ConsentSubjects.Messaging,
      pool,
    });
    await submitConsent({
      logger: mockLogger,
      pool,
      userId: p.id,
      consentInput: {
        subject: ConsentSubjects.Messaging,
        status: ConsentStatuses.OptedIn,
        consentStatementId,
      },
      reason: CascadeConsentReasons.FirstImport,
    });

    const result = await listProfiles({
      pool,
      organisationId,
      pagination: defaultPagination,
      searchParams: {
        search: p.firstName,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
      },
      consentSubjects: [],
    });

    expect(result.data.length).toBe(1);
    expect(result.data.map((p) => p.id)).toContain(p.id);
    // In this case consent status must be null
    // even if set on db because we didn't
    // include consentSubjects in params
    expect(result.data[0].consentStatuses).toBeNull();

    const withConsent = await listProfiles({
      pool,
      organisationId,
      pagination: defaultPagination,
      searchParams: {
        search: p.firstName,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
      },
      consentSubjects: [ConsentSubjects.Messaging],
    });

    expect(withConsent.data.length).toBe(1);
    expect(withConsent.data.map((p) => p.id)).toContain(p.id);
    expect(withConsent.data[0].consentStatuses).not.toBeNull();
    expect(withConsent.data[0].consentStatuses?.messaging).toBeDefined();
    expect(withConsent.data[0].consentStatuses).toEqual({
      messaging: {
        status: ConsentStatuses.OptedIn,
        consent_statement_id: consentStatementId,
      },
    });
  });

  it("should list profiles using last imported email", async () => {
    const p1 = await createProfileWithDetails({
      id: randomUUID().substring(0, 12),
      detailsId: randomUUID(),
      email: `${randomUUID().substring(0, 8)}@mail.com`,
      setLatestDetail: false,
    });

    const updatedEmail = `${randomUUID().substring(0, 8)}@mail.com`;
    await createDetailsAndDataForProfile({
      detailsId: randomUUID(),
      profileId: p1.id,
      firstName: p1.firstName,
      lastName: p1.lastName,
      email: updatedEmail,
      ppsn: p1.ppsn,
      setLatestDetail: true,
    });

    const result = await listProfiles({
      pool,
      organisationId,
      pagination: { limit: "100", offset: "0" },
      consentSubjects: [],
    });

    const found = result.data.find((pr) => pr.id === p1.id);
    expect(found).toBeDefined();
    expect(found?.email).toBe(updatedEmail);
    expect(found?.details?.email).toBe(updatedEmail);
  });

  it("should handle database errors", async () => {
    // Simulate error by closing pool
    await pool.end();
    await expect(
      listProfiles({
        pool,
        organisationId,
        pagination: defaultPagination,
        searchParams: {
          search: `${randomUUID()}123`,
        },
        consentSubjects: [],
      }),
    ).rejects.toThrow();
  });
});
