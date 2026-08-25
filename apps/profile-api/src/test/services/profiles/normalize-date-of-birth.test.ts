import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { Logger } from "pino";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { normalizeDateOfBirth } from "~/services/profiles/normalize-date-of-birth.js";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import { createProfileDetails } from "~/services/profiles/sql/create-profile-details.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";

const getMockProfile = () => {
  const id = randomUUID().substring(0, 12);
  return {
    id,
    primaryUserId: id,
    publicName: randomUUID().substring(0, 13),
    email: `${randomUUID().substring(0, 10)}@example.com`,
  };
};

const buildMockLogger = (): Logger =>
  ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
    level: "info",
    msgPrefix: "",
  }) as unknown as Logger;

const insertRawDateOfBirth = async (
  client: PoolClient,
  profileDetailsId: string,
  name: "dateOfBirth",
  value: string,
) => {
  await client.query(
    `INSERT INTO profile_data (profile_details_id, name, value_type, value)
     VALUES ($1, $2, 'string', $3)`,
    [profileDetailsId, name, value],
  );
};

const getProfileDataValue = async (
  client: PoolClient,
  profileDetailsId: string,
  name: "dateOfBirth",
): Promise<string | null> => {
  const { rows } = await client.query<{ value: string }>(
    `SELECT value FROM profile_data WHERE profile_details_id = $1 AND name = $2`,
    [profileDetailsId, name],
  );
  return rows[0]?.value ?? null;
};

describe("normalizeDateOfBirth", () => {
  const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
  let client: PoolClient;

  beforeAll(async () => {
    client = await pool.connect();
  });

  afterAll(async () => {
    client.release();
    if (!pool.ended) {
      await pool.end();
    }
  });

  it("should normalize a slash-format date (dd/mm/yyyy) to ISO date", async () => {
    const profile = getMockProfile();
    await createProfile(client, profile);
    const profileDetailsId = await createProfileDetails(
      client,
      profile.id,
      "org-1",
    );

    await insertRawDateOfBirth(
      client,
      profileDetailsId,
      "dateOfBirth",
      "15/06/1990",
    );

    const logger = buildMockLogger();
    await normalizeDateOfBirth({ pool, logger });

    const value = await getProfileDataValue(
      client,
      profileDetailsId,
      "dateOfBirth",
    );
    expect(value).toBe("1990-06-15");
  });

  it("should skip rows that are already in ISO date format", async () => {
    const profile = getMockProfile();
    await createProfile(client, profile);
    const profileDetailsId = await createProfileDetails(
      client,
      profile.id,
      "org-3",
    );

    await insertRawDateOfBirth(
      client,
      profileDetailsId,
      "dateOfBirth",
      "1985-03-22",
    );

    const logger = buildMockLogger();
    await normalizeDateOfBirth({ pool, logger });

    const value = await getProfileDataValue(
      client,
      profileDetailsId,
      "dateOfBirth",
    );
    expect(value).toBe("1985-03-22");
  });

  it("should skip rows whose profile_details is not is_latest", async () => {
    const profile = getMockProfile();
    await createProfile(client, profile);

    // Insert a non-latest profile_details
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO profile_details (profile_id, organisation_id, is_latest)
       VALUES ($1, $2, false) RETURNING id`,
      [profile.id, "org-4"],
    );
    const staleProfileDetailsId = rows[0].id;

    await insertRawDateOfBirth(
      client,
      staleProfileDetailsId,
      "dateOfBirth",
      "10/05/1975",
    );

    const logger = buildMockLogger();
    await normalizeDateOfBirth({ pool, logger });

    // Should remain unchanged — not picked up because is_latest = false
    const value = await getProfileDataValue(
      client,
      staleProfileDetailsId,
      "dateOfBirth",
    );
    expect(value).toBe("10/05/1975");
  });

  it("should warn and skip rows with an unparseable date value", async () => {
    const profile = getMockProfile();
    await createProfile(client, profile);
    const profileDetailsId = await createProfileDetails(
      client,
      profile.id,
      "org-5",
    );

    await insertRawDateOfBirth(
      client,
      profileDetailsId,
      "dateOfBirth",
      "not-a-date",
    );

    const logger = buildMockLogger();
    await normalizeDateOfBirth({ pool, logger });

    // Value should be left unchanged
    const value = await getProfileDataValue(
      client,
      profileDetailsId,
      "dateOfBirth",
    );
    expect(value).toBe("not-a-date");
  });

  it("should log start and finish messages", async () => {
    const logger = buildMockLogger();
    await normalizeDateOfBirth({ pool, logger });

    expect(logger.info).toHaveBeenCalledWith(
      "Starting date-of-birth normalization",
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        totalProcessed: expect.any(Number),
        totalUpdated: expect.any(Number),
      }),
      "Finished date-of-birth normalization",
    );
  });

  it("should normalize multiple rows across different profiles", async () => {
    const profiles = Array.from({ length: 3 }, () => getMockProfile());
    const detailsIds: string[] = [];

    for (const profile of profiles) {
      await createProfile(client, profile);
      const detailsId = await createProfileDetails(client, profile.id, "org-6");
      detailsIds.push(detailsId);
      await insertRawDateOfBirth(
        client,
        detailsId,
        "dateOfBirth",
        "20/07/1999",
      );
    }

    const logger = buildMockLogger();
    await normalizeDateOfBirth({ pool, logger });

    for (const detailsId of detailsIds) {
      const value = await getProfileDataValue(client, detailsId, "dateOfBirth");
      expect(value).toBe("1999-07-20");
    }
  });
});
