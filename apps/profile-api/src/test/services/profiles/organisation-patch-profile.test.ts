import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { organisationPatchProfile } from "~/services/profiles/organisations/patch-profile.js";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import { buildMockLogger } from "~/test/build-mock-logger.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";

const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
const { logger } = buildMockLogger({});

const newId = () => randomUUID().substring(0, 12);

const createTestProfile = async (id: string, primaryUserId = id) => {
  const client = await pool.connect();
  try {
    await createProfile(client, {
      id,
      primaryUserId,
      publicName: `User ${id}`,
      email: `${id}@example.com`,
    });
  } finally {
    client.release();
  }
  return id;
};

describe("organisationPatchProfile", () => {
  afterAll(async () => {
    if (!pool.ended) {
      await pool.end();
    }
  });

  it("throws 404 when the profile to update does not exist", async () => {
    await expect(
      organisationPatchProfile({
        pool,
        profileIdToUpdate: "missing-prof",
        payload: { primaryUserId: null },
        logger,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("is a no-op when the primaryUserId does not change", async () => {
    const profileId = await createTestProfile(newId());

    const result = await organisationPatchProfile({
      pool,
      profileIdToUpdate: profileId,
      payload: { primaryUserId: null },
      logger,
    });

    expect(result).toEqual({ primaryUserId: profileId });
  });

  it("rejects updating a profile that has linked profiles", async () => {
    const primaryId = await createTestProfile(newId());
    await createTestProfile(newId(), primaryId);
    const newParentId = await createTestProfile(newId());

    await expect(
      organisationPatchProfile({
        pool,
        profileIdToUpdate: primaryId,
        payload: { primaryUserId: newParentId },
        logger,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a primaryUserId that does not exist", async () => {
    const profileId = await createTestProfile(newId());

    await expect(
      organisationPatchProfile({
        pool,
        profileIdToUpdate: profileId,
        payload: { primaryUserId: "missing-prnt" },
        logger,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rejects a primaryUserId pointing at a child profile", async () => {
    const grandParentId = await createTestProfile(newId());
    const childId = await createTestProfile(newId(), grandParentId);
    const profileId = await createTestProfile(newId());

    await expect(
      organisationPatchProfile({
        pool,
        profileIdToUpdate: profileId,
        payload: { primaryUserId: childId },
        logger,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("links the profile to a new primary and cascades consent", async () => {
    const parentId = await createTestProfile(newId());
    const profileId = await createTestProfile(newId());

    const result = await organisationPatchProfile({
      pool,
      profileIdToUpdate: profileId,
      payload: { primaryUserId: parentId },
      logger,
    });

    expect(result).toEqual({ primaryUserId: parentId });

    const { rows } = await pool.query(
      `SELECT primary_user_id FROM profiles WHERE id = $1`,
      [profileId],
    );
    expect(rows[0].primary_user_id).toBe(parentId);
  });

  it("detaches a child profile back to itself", async () => {
    const parentId = await createTestProfile(newId());
    const childId = await createTestProfile(newId(), parentId);

    const result = await organisationPatchProfile({
      pool,
      profileIdToUpdate: childId,
      payload: { primaryUserId: null },
      logger,
    });

    expect(result).toEqual({ primaryUserId: childId });
  });
});
