import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Profile } from "~/schemas/profiles/model.js";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import { createProfileDataForProfileDetail } from "~/services/profiles/sql/create-profile-data-for-profile-details.js";
import { createProfileDetails } from "~/services/profiles/sql/create-profile-details.js";
import { findProfileWithData } from "~/services/profiles/sql/find-profile-with-data.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { mockDbProfiles, mockProfileDetails } from "~/test/fixtures/common.js";

const getMockProfile = (): Profile => ({
  id: randomUUID().substring(0, 12),
  publicName: randomUUID(),
  email: `${randomUUID().substring(0, 10)}@email.com`,
  primaryUserId: randomUUID().substring(0, 12),
  preferredLanguage: "en",
  status: "active",
});

describe("createProfileDataForProfileDetail", () => {
  const getSampleProfile = () => ({
    ...mockDbProfiles[0],
    safeLevel: 1,
    id: randomUUID().substring(0, 12),
    email: `${randomUUID().substring(0, 5)}@example.com`,
  });

  const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
  let client: PoolClient;
  const sampleProfile = getSampleProfile();
  const orgId = randomUUID().substring(0, 11);
  let profileDetailId: string;

  beforeAll(async () => {
    client = await pool.connect();

    const created = await createProfile(client, sampleProfile);
    profileDetailId = await createProfileDetails(client, created, orgId);

    client.release();
  });

  afterAll(async () => {
    if (!pool.ended) {
      await pool.end();
    }
  });

  it("should handle empty data object without executing query", async () => {
    const before = await client.query(
      "SELECT COUNT(*) FROM profile_data where profile_details_id = $1",
      [profileDetailId],
    );

    await createProfileDataForProfileDetail(client, profileDetailId, {});

    const after = await client.query(
      "SELECT COUNT(*) FROM profile_data where profile_details_id = $1",
      [profileDetailId],
    );

    expect(after.rows[0].count).toBe(before.rows[0].count);
  });

  it("should insert single value with correct parameters", async () => {
    const data = { firstName: mockProfileDetails.name };
    const createdProfileId = await createProfile(client, getMockProfile());
    const orgId = `create-profile-data-${randomUUID().substring(0, 5)}`;
    const createdDetails = await createProfileDetails(
      client,
      createdProfileId,
      orgId,
    );

    await createProfileDataForProfileDetail(client, createdDetails, data);

    const profile = await findProfileWithData(
      client,
      orgId,
      createdProfileId,
      [],
    );
    expect(profile).toBeDefined();
    expect(profile?.details?.firstName.value).toStrictEqual(
      mockProfileDetails.name,
    );
  });

  it("should handle not-recognized values correctly", async () => {
    const data = {
      ...mockProfileDetails,
      city: "City",
      email: "email@me.com",
      address: "address",
      phone: "+3343231",
      firstName: "name",
      lastName: "sur",
      dateOfBirth: "2000-01-01",
      ppsn: "PPSN-1234",
    };

    const createdProfileId = await createProfile(client, getMockProfile());
    const orgId = `create-profile-data-${randomUUID().substring(0, 5)}`;
    const createdDetails = await createProfileDetails(
      client,
      createdProfileId,
      orgId,
    );

    await createProfileDataForProfileDetail(client, createdDetails, data);

    const profile = await findProfileWithData(
      client,
      orgId,
      createdProfileId,
      [],
    );
    expect(profile).toBeDefined();
    expect(profile?.details?.firstName.value).toStrictEqual(data.firstName);
    expect(profile?.details?.lastName.value).toStrictEqual(data.lastName);
    expect(profile?.details?.dateOfBirth.value).toStrictEqual(data.dateOfBirth);
    expect(profile?.details?.email.value).toStrictEqual(data.email);
    expect(profile?.details?.ppsn.value).toStrictEqual(data.ppsn);
    expect(profile?.details?.city.value).toStrictEqual(data.city);
    expect(profile?.details?.address.value).toStrictEqual(data.address);
  });
});
