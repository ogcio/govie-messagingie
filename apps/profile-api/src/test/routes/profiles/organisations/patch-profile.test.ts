import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CascadeConsentReasons,
  ConsentStatuses,
  ConsentSubjects,
} from "~/schemas/consents/shared.js";
import type { ProfileWithLinkedProfiles } from "~/schemas/profiles/model.js";
import type { PutProfileBody } from "~/schemas/profiles/update.js";
import { getCurrentConsentStatement } from "~/services/consent-statements/consent-statements-service.js";
import { submitConsent } from "~/services/consents/consents-service.js";
import { getProfile } from "~/services/profiles/get-profile.js";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import { createProfileDataForProfileDetail } from "~/services/profiles/sql/create-profile-data-for-profile-details.js";
import { createProfileDetails } from "~/services/profiles/sql/create-profile-details.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { build } from "~/test/test-server-builder.js";

const organizationId = "org-id";
const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);

const patchTestParam = {
  method: "PATCH" as "PUT" | "PATCH",
  ...(await createUser(
    pool,
    getFullBody(),
    getFullBody(),
    randomUUID().substring(0, 12),
    organizationId,
    false,
  )),
};
const primaryUserId = randomUUID().substring(0, 12);
const primaryUser = await createUser(
  pool,
  getFullBody(),
  getFullBody(),
  primaryUserId,
  organizationId,
  true,
);

let app: FastifyInstance;
describe(`${patchTestParam.method} - /api/v1/organisations/profiles/{id}`, async () => {
  beforeAll(async () => {
    app = await build();
    prepareOnRequestHook(app);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it("Returns 404 if profile to update does not exist", async () => {
    const response = await app.inject({
      method: patchTestParam.method,
      url: "/api/v1/organisations/profiles/user-not-exist",
      body: { primaryUserId: primaryUserId },
    });

    expect(response.statusCode).toBe(404);
  });

  it("Returns 404 if primary user id does not exist", async () => {
    const response = await app.inject({
      method: patchTestParam.method,
      url: `/api/v1/organisations/profiles/${patchTestParam.profileId}`,
      body: { primaryUserId: "user-not-exist" },
    });

    expect(response.statusCode).toBe(404);
  });

  it("Returns 400 if the primary user to set is a child", async () => {
    const temporaryParentUserId = randomUUID().substring(0, 12);
    // create a parent user
    await createUser(
      pool,
      getFullBody(),
      getFullBody(),
      temporaryParentUserId,
      organizationId,
      true,
    );
    const childPrimaryUserId = randomUUID().substring(0, 12);
    await createUser(
      pool,
      getFullBody(),
      getFullBody(),

      childPrimaryUserId,
      organizationId,
      true,
      temporaryParentUserId,
    );
    const response = await app.inject({
      method: patchTestParam.method,
      url: `/api/v1/organisations/profiles/${patchTestParam.profileId}`,
      body: {
        primaryUserId: childPrimaryUserId,
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("Returns 400 if the child user is already a parent", async () => {
    const temporaryParentUserId = randomUUID().substring(0, 12);
    // create a parent user
    await createUser(
      pool,
      getFullBody(),
      getFullBody(),
      temporaryParentUserId,
      organizationId,
      true,
    );
    const childPrimaryUserId = randomUUID().substring(0, 12);
    await createUser(
      pool,
      getFullBody(),
      getFullBody(),
      childPrimaryUserId,
      organizationId,
      true,
      temporaryParentUserId,
    );
    const unlinkedUserId = randomUUID().substring(0, 12);
    await createUser(
      pool,
      getFullBody(),
      getFullBody(),
      unlinkedUserId,
      organizationId,
      true,
    );
    const response = await app.inject({
      method: patchTestParam.method,
      url: `/api/v1/organisations/profiles/${temporaryParentUserId}`,
      body: {
        primaryUserId: unlinkedUserId,
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("Returns 200 same primary user id is the same as the already one", async () => {
    const response = await app.inject({
      method: patchTestParam.method,
      url: `/api/v1/organisations/profiles/${patchTestParam.profileId}`,
      body: {
        primaryUserId: patchTestParam.profileId,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.primaryUserId).toBe(patchTestParam.profileId);
  });

  it("Returns 200 if the primary user id is valid and set", async () => {
    const response = await app.inject({
      method: patchTestParam.method,
      url: `/api/v1/organisations/profiles/${patchTestParam.profileId}`,
      body: {
        primaryUserId: primaryUser.profileId,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.primaryUserId).toBe(primaryUser.profileId);
  });

  it("Correctly cascades consent", async () => {
    const temporaryParentUserId = randomUUID().substring(0, 12);
    // create a parent user
    await createUser(
      pool,
      getFullBody(),
      getFullBody(),
      temporaryParentUserId,
      organizationId,
      true,
    );
    await submitConsent({
      pool: pool,
      userId: temporaryParentUserId,
      consentInput: {
        consentStatementId: (
          await getCurrentConsentStatement({
            pool,
            subject: ConsentSubjects.Messaging,
          })
        ).id,
        subject: ConsentSubjects.Messaging,
        status: ConsentStatuses.OptedOut,
      },
      logger: app.log,
      reason: CascadeConsentReasons.ExplicitSubmission,
    });

    const unlinkedUserId = randomUUID().substring(0, 12);
    await createUser(
      pool,
      getFullBody(),
      getFullBody(),
      unlinkedUserId,
      organizationId,
      true,
    );

    const response = await app.inject({
      method: patchTestParam.method,
      url: `/api/v1/organisations/profiles/${unlinkedUserId}`,
      body: {
        primaryUserId: temporaryParentUserId,
      },
    });

    expect(response.statusCode).toBe(200);
    const childProfileAfterLinking = (await getProfile({
      organizationId: undefined,
      pool,
      profileId: unlinkedUserId,
      consentSubjects: [ConsentSubjects.Messaging],
      addLinkedProfiles: false,
    })) as ProfileWithLinkedProfiles;

    expect(childProfileAfterLinking.consentStatuses).toBeDefined();
    expect(childProfileAfterLinking.consentStatuses).not.toBeNull();
    expect(
      childProfileAfterLinking.consentStatuses?.[ConsentSubjects.Messaging]
        .status,
    ).toBe(ConsentStatuses.OptedOut);
  });

  it("Returns 200 if unlinking correctly using null", async () => {
    //link
    const first = await app.inject({
      method: patchTestParam.method,
      url: `/api/v1/organisations/profiles/${patchTestParam.profileId}`,
      body: {
        primaryUserId: primaryUser.profileId,
      },
    });

    expect(first.statusCode).toBe(200);
    // unlink
    const response = await app.inject({
      method: patchTestParam.method,
      url: `/api/v1/organisations/profiles/${patchTestParam.profileId}`,
      body: {
        primaryUserId: null,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.primaryUserId).toBe(patchTestParam.profileId);
  });

  it("Returns 200 if unlinking correctly using own id", async () => {
    //link
    const first = await app.inject({
      method: patchTestParam.method,
      url: `/api/v1/organisations/profiles/${patchTestParam.profileId}`,
      body: {
        primaryUserId: primaryUser.profileId,
      },
    });

    expect(first.statusCode).toBe(200);
    // unlink
    const response = await app.inject({
      method: patchTestParam.method,
      url: `/api/v1/organisations/profiles/${patchTestParam.profileId}`,
      body: {
        primaryUserId: patchTestParam.profileId,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.primaryUserId).toBe(patchTestParam.profileId);
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

function prepareOnRequestHook(app: FastifyInstance): void {
  app.addHook("onRequest", async (req: FastifyRequest) => {
    // Override the request decorator
    app.checkPermissions = async (
      request: FastifyRequest,
      _reply: FastifyReply,
      _permissions: string[],
      _matchConfig?: { method: "AND" | "OR" },
    ) => {
      req.userData = {
        userId: "user-1234",
        accessToken: "accessToken",
        organizationId: undefined,
        isM2MApplication: false,
      };

      request.userData = req.userData;
    };
  });
}

async function createUser(
  pool: Pool,
  withoutOrgBody: Omit<Required<PutProfileBody>, "publicName" | "email">,
  withOrgBody: Required<PutProfileBody>,
  profileId: string,
  organizationId: string,
  createGenericDetails: boolean,
  toSetPrimaryUserId?: string,
) {
  const beforeAllClient = await pool.connect();
  await createProfile(beforeAllClient, {
    ...withOrgBody,
    primaryUserId: toSetPrimaryUserId ?? profileId,
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
  if (createGenericDetails) {
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
  }
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
