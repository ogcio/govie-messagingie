import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import type { ProfileWithDetails } from "~/schemas/profiles/model.js";
import type { PutProfileBody } from "~/schemas/profiles/update.js";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import { createProfileDataForProfileDetail } from "~/services/profiles/sql/create-profile-data-for-profile-details.js";
import { createProfileDetails } from "~/services/profiles/sql/create-profile-details.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { buildOnce } from "~/test/test-server-builder.js";

const organizationId = "org-id";
const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
const putTestParam = {
  method: "PUT" as "PUT" | "PATCH",
  ...(await createUser(
    pool,
    getFullBody(),
    getFullBody(),
    randomUUID().substring(0, 12),
    organizationId,
  )),
};
const patchTestParam = {
  method: "PATCH" as "PUT" | "PATCH",
  ...(await createUser(
    pool,
    getFullBody(),
    getFullBody(),
    randomUUID().substring(0, 12),
    organizationId,
  )),
};
const testParameters: {
  method: "PUT" | "PATCH";
  withoutOrgBody: Required<PutProfileBody>;
  withOrgBody: Required<PutProfileBody>;
  profileId: string;
}[] = [putTestParam, patchTestParam];

const { app, setAuth } = await buildOnce();

afterAll(async () => {
  await app.close();
});

for (const testCase of testParameters) {
  describe(`${testCase.method} - /api/v1/profiles/{id} - My own profile`, async () => {
    it("Returns 404 if profile does not exist with org", async () => {
      setAuth({ userId: "not-exist" });

      const response = await app.inject({
        method: testCase.method,
        url: "/api/v1/profiles/not-exist",
        query: organizationId,
        body: getFullBody(),
      });

      expect(response.statusCode).toBe(404);
    });

    it("Returns 404 if profile does not exist", async () => {
      setAuth({ userId: "not-exist" });

      const response = await app.inject({
        method: testCase.method,
        url: "/api/v1/profiles/not-exist",
        body: getFullBody(),
      });

      expect(response.statusCode).toBe(404);
    });

    it("Primary user id is not updated in any case", async () => {
      setAuth({ userId: testCase.profileId });
      const response = await app.inject({
        method: testCase.method,
        url: `/api/v1/profiles/${testCase.profileId}`,
        body: { ...getFullBody(), primaryUserId: "new-user-id" },
      });

      expect(response.statusCode).toBe(200);
      const responseBody = response.json();
      expect(responseBody.data.primaryUserId).toStrictEqual(testCase.profileId);
    });

    it("Data are correctly updated", async () => {
      setAuth({ userId: testCase.profileId });
      const inputBody = getFullBody();
      const response = await app.inject({
        method: testCase.method,
        url: `/api/v1/profiles/${testCase.profileId}`,
        body: inputBody,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = response.json().data as ProfileWithDetails;
      expect(responseBody.id).toStrictEqual(testCase.profileId);
      expect(responseBody.publicName).toStrictEqual(inputBody.publicName);
      expect(responseBody.email).toStrictEqual(testCase.withoutOrgBody.email);
      expect(responseBody.primaryUserId).toStrictEqual(testCase.profileId);
      expect(responseBody.preferredLanguage).toStrictEqual(
        inputBody.preferredLanguage,
      );
      expect(responseBody.details).toBeDefined();
      expect(responseBody.details?.email).toStrictEqual(inputBody.email);
      expect(responseBody.details?.firstName).toStrictEqual(
        inputBody.firstName,
      );
      expect(responseBody.details?.lastName).toStrictEqual(inputBody.lastName);
      expect(responseBody.details?.city).toStrictEqual(
        testCase.withoutOrgBody.city,
      );
      expect(responseBody.details?.address).toStrictEqual(
        testCase.withoutOrgBody.address,
      );
      expect(responseBody.details?.phone).toStrictEqual(
        testCase.withoutOrgBody.phone,
      );
      expect(responseBody.details?.dateOfBirth).toStrictEqual(
        `${testCase.withoutOrgBody.dateOfBirth}T00:00:00.000Z`,
      );
    });

    it("Data are correctly updated with org id", async () => {
      setAuth({ userId: testCase.profileId });
      const inputBody = getFullBody();
      const response = await app.inject({
        method: testCase.method,
        url: `/api/v1/profiles/${testCase.profileId}`,
        query: { organizationId },
        body: inputBody,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = response.json().data as ProfileWithDetails;
      expect(responseBody.id).toStrictEqual(testCase.profileId);
      expect(responseBody.publicName).toStrictEqual(inputBody.publicName);
      expect(responseBody.email).toStrictEqual(testCase.withOrgBody.email);
      expect(responseBody.primaryUserId).toStrictEqual(testCase.profileId);
      expect(responseBody.preferredLanguage).toStrictEqual(
        inputBody.preferredLanguage,
      );
      expect(responseBody.details).toBeDefined();
      expect(responseBody.details?.email).toStrictEqual(inputBody.email);
      expect(responseBody.details?.firstName).toStrictEqual(
        inputBody.firstName,
      );
      expect(responseBody.details?.lastName).toStrictEqual(inputBody.lastName);
      expect(responseBody.details?.city).toStrictEqual(
        testCase.withOrgBody.city,
      );
      expect(responseBody.details?.address).toStrictEqual(
        testCase.withOrgBody.address,
      );
      expect(responseBody.details?.phone).toStrictEqual(
        testCase.withOrgBody.phone,
      );
      expect(responseBody.details?.dateOfBirth).toStrictEqual(
        `${testCase.withOrgBody.dateOfBirth}T00:00:00.000Z`,
      );
    });
  });
}

describe("PUT - /api/v1/profiles/{id} - My own profile", async () => {
  it("Public name is required", async () => {
    setAuth({ userId: putTestParam.profileId });
    const inputBody = getFullBody() as Record<string, string | number>;

    delete inputBody.publicName;
    const response = await app.inject({
      method: putTestParam.method,
      url: `/api/v1/profiles/${putTestParam.profileId}`,
      query: organizationId,
      body: inputBody,
    });

    expect(response.statusCode).toBe(422);
  });
});

describe("PATCH - /api/v1/profiles/{id} - My own profile", async () => {
  it("Public name is optional", async () => {
    setAuth({ userId: patchTestParam.profileId });
    const inputBody = getFullBody() as Record<string, string | number>;

    delete inputBody.publicName;
    const response = await app.inject({
      method: patchTestParam.method,
      url: `/api/v1/profiles/${patchTestParam.profileId}`,
      query: organizationId,
      body: inputBody,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.publicName).toStrictEqual(
      patchTestParam.withOrgBody.publicName,
    );
  });
});

function getFullBody(): Required<PutProfileBody> {
  return {
    publicName: "Public Name",
    email: "public@name.com",
    phone: "+3333333",
    address: "Road",
    city: "City",
    firstName: "First",
    lastName: "Last",
    dateOfBirth: "2000-01-02",
    preferredLanguage: "ga",
  };
}

async function createUser(
  pool: Pool,
  withoutOrgBody: Omit<Required<PutProfileBody>, "publicName" | "email">,
  withOrgBody: Required<PutProfileBody>,
  profileId: string,
  organizationId: string,
) {
  const beforeAllClient = await pool.connect();
  await createProfile(beforeAllClient, {
    ...withOrgBody,
    primaryUserId: profileId,
    id: profileId,
  });
  const createdDetails = await createProfileDetails(
    beforeAllClient,
    profileId,
    organizationId,
  );

  await createProfileDataForProfileDetail(
    beforeAllClient,
    createdDetails,
    withOrgBody,
  );
  const createdDetailsGeneric = await createProfileDetails(
    beforeAllClient,
    profileId,
    undefined,
  );

  await createProfileDataForProfileDetail(
    beforeAllClient,
    createdDetailsGeneric,
    withoutOrgBody,
  );
  beforeAllClient.release();

  return {
    withOrgBody,
    withoutOrgBody: {
      ...withoutOrgBody,
      publicName: withOrgBody.publicName,
      email: withOrgBody.email,
    },
    profileId,
  };
}
