import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { mockDbProfiles } from "~/test/fixtures/common.js";

describe("createProfile", () => {
  const getSampleProfile = () => ({
    ...mockDbProfiles[0],
    safeLevel: 1,
    id: randomUUID().substring(0, 12),
    email: `${randomUUID().substring(0, 5)}@example.com`,
  });

  const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
  let client: PoolClient;

  beforeEach(async () => {
    client = await pool.connect();
  });

  afterEach(() => {
    if (client) {
      client.release();
    }
  });
  afterAll(async () => {
    if (!pool.ended) {
      await pool.end();
    }
  });

  it("should insert new profile and return ID", async () => {
    const sampleProfile = getSampleProfile();
    const result = await createProfile(client, sampleProfile);

    expect(result).toBe(sampleProfile.id);

    const fromDb = await client.query("SELECT * FROM profiles WHERE id = $1", [
      result,
    ]);
    expect(fromDb.rowCount).toBe(1);
    expect(fromDb.rows[0].public_name).toEqual(sampleProfile.publicName);
    expect(fromDb.rows[0].email).toEqual(sampleProfile.email);
    expect(fromDb.rows[0].primary_user_id).toEqual(sampleProfile.primaryUserId);
    expect(fromDb.rows[0].safe_level).toEqual(sampleProfile.safeLevel);
    expect(fromDb.rows[0].preferred_language).toEqual(
      sampleProfile.preferredLanguage,
    );
  });

  it("should throw error if insert fails", async () => {
    const sampleProfile = getSampleProfile();
    // users.id length on db is 12, uuid is longer
    const longerUuidProfile = { ...sampleProfile, id: randomUUID() };

    await expect(createProfile(client, longerUuidProfile)).rejects.toThrow();
  });

  it("should use upsert with proper conditions", async () => {
    const sampleProfile = getSampleProfile();
    await createProfile(client, sampleProfile);
    const upsertedProfile = {
      ...sampleProfile,
      publicName: "Updated Name",
      email: `${randomUUID().substring(0, 7)}@example.com`,
    };
    const upserted = await createProfile(client, upsertedProfile);

    expect(upserted).toBe(sampleProfile.id);
    const fromDb = await client.query("SELECT * FROM profiles WHERE id = $1", [
      upserted,
    ]);
    expect(fromDb.rowCount).toBe(1);
    expect(fromDb.rows[0].public_name).toEqual(upsertedProfile.publicName);
    expect(fromDb.rows[0].email).toEqual(upsertedProfile.email);
    expect(fromDb.rows[0].primary_user_id).toEqual(sampleProfile.primaryUserId);
    expect(fromDb.rows[0].safe_level).toEqual(sampleProfile.safeLevel);
    expect(fromDb.rows[0].preferred_language).toEqual(
      sampleProfile.preferredLanguage,
    );
  });

  it("should use default 'en' for preferredLanguage if not provided", async () => {
    const profileWithoutLanguage = getSampleProfile();
    profileWithoutLanguage.preferredLanguage = undefined;

    await createProfile(client, profileWithoutLanguage);

    const fromDb = await client.query("SELECT * FROM profiles WHERE id = $1", [
      profileWithoutLanguage.id,
    ]);
    expect(fromDb.rowCount).toBe(1);
    expect(fromDb.rows[0].preferred_language).toEqual("en");
  });
});
