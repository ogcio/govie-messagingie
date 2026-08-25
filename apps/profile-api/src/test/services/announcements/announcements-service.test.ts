import { randomUUID } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import type { PoolClient } from "pg";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import type { AnnouncementApplicationId } from "~/schemas/announcements/shared.js";
import {
  acknowledgeAnnouncements,
  createAnnouncement,
  getAnnouncementById,
  listAnnouncements,
  listCitizenAnnouncements,
  setAnnouncementEnabled,
} from "~/services/announcements/announcements-service.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { insertTestAnnouncement } from "~/test/insert-test-announcement.js";

const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
const mockLogger: FastifyBaseLogger = {
  debug: vi.fn(),
  error: vi.fn(),
  child: vi.fn(),
  level: "info",
  fatal: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  trace: vi.fn(),
  silent: vi.fn(),
} as unknown as FastifyBaseLogger;

describe("announcements-service", () => {
  const usedAnnouncementIds = new Set<string>();
  const usedProfileIds = new Set<string>();

  const insertProfile = async (profileId = randomUUID().substring(0, 12)) => {
    await pool.query(
      `INSERT INTO profiles (
         id,
         public_name,
         email,
         primary_user_id,
         safe_level,
         preferred_language
       )
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        profileId,
        `Profile ${profileId}`,
        `${profileId}@example.com`,
        profileId,
        0,
        "en",
      ],
    );

    usedProfileIds.add(profileId);
    return profileId;
  };

  const insertProfileDetails = async (params: {
    profileId: string;
    createdAt: string;
    organisationId?: string | null;
    isLatest?: boolean;
  }) => {
    await pool.query(
      `INSERT INTO profile_details (
         profile_id,
         organisation_id,
         is_latest,
         created_at
       )
       VALUES ($1, $2, $3, $4)`,
      [
        params.profileId,
        params.organisationId ?? null,
        params.isLatest ?? true,
        params.createdAt,
      ],
    );
  };

  const seedAnnouncement = async (params?: {
    applicationId?: AnnouncementApplicationId;
    isEnabled?: boolean;
    publishDate?: string;
    loggedInUserId?: string | null;
  }) => {
    const applicationId = params?.applicationId ?? "profile";

    const publishDate =
      params?.publishDate ??
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const result = await createAnnouncement({
      pool,
      announcement: {
        applicationId,
        isEnabled: params?.isEnabled ?? true,
        publishDate,
        translations: {
          en: {
            title: `Announcement ${applicationId}`,
            description: `English description ${applicationId}`,
          },
          ga: {
            title: `Fogra ${applicationId}`,
            description: `Cur sios ${applicationId}`,
          },
        },
      },
      logger: mockLogger,
      loggedInUserId: params?.loggedInUserId ?? "seed-user",
    });

    return {
      id: result.id,
      applicationId,
      publishDate,
    };
  };

  const insertAnnouncement = async (params?: {
    applicationId?: string;
    isEnabled?: boolean;
    publishDate?: string;
    createdBy?: string | null;
  }) => {
    const applicationId =
      params?.applicationId ?? `announcements-${randomUUID().substring(0, 8)}`;

    const publishDate =
      params?.publishDate ??
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const result = await insertTestAnnouncement(pool, {
      applicationId,
      isEnabled: params?.isEnabled,
      publishDate: new Date(publishDate),
      createdBy: params?.createdBy ?? "seed-user",
    });

    usedAnnouncementIds.add(result.id);

    return {
      id: result.id,
      applicationId,
      publishDate,
    };
  };

  afterEach(async () => {
    const announcementIds = [...usedAnnouncementIds];

    if (announcementIds.length > 0) {
      await pool.query(
        "DELETE FROM announcement_acknowledgements WHERE announcement_id = ANY($1)",
        [announcementIds],
      );
      await pool.query(
        "DELETE FROM announcement_translations WHERE announcement_id = ANY($1)",
        [announcementIds],
      );
      await pool.query("DELETE FROM announcements WHERE id = ANY($1)", [
        announcementIds,
      ]);

      usedAnnouncementIds.clear();
    }

    const profileIds = [...usedProfileIds];
    if (profileIds.length > 0) {
      await pool.query(
        "DELETE FROM profile_details WHERE profile_id = ANY($1)",
        [profileIds],
      );
      await pool.query("DELETE FROM profiles WHERE id = ANY($1)", [profileIds]);

      usedProfileIds.clear();
    }
  });

  afterAll(async () => {
    if (!pool.ended) {
      await pool.end();
    }
  });

  it("persists translations and publishDate on create", async () => {
    const seeded = await seedAnnouncement({ loggedInUserId: "service-user" });
    usedAnnouncementIds.add(seeded.id);

    const { rows: announcementRows } = await pool.query(
      `SELECT application_id, publish_date, created_by
         FROM announcements
        WHERE id = $1`,
      [seeded.id],
    );
    expect(announcementRows).toHaveLength(1);
    expect(announcementRows[0].application_id).toBe(seeded.applicationId);
    expect(announcementRows[0].publish_date.toISOString()).toBe(
      seeded.publishDate,
    );
    expect(announcementRows[0].created_by).toBe("service-user");

    const { rows: translationRows } = await pool.query(
      `SELECT language, title
         FROM announcement_translations
        WHERE announcement_id = $1`,
      [seeded.id],
    );
    expect(translationRows).toHaveLength(2);
    expect(translationRows.map((row) => row.language)).toEqual(
      expect.arrayContaining(["en", "ga"]),
    );
  });

  it("lists announcements with applicationId and isEnabled filters", async () => {
    const applicationId = `announcements-${randomUUID().substring(0, 8)}`;
    const otherApplicationId = `announcements-${randomUUID().substring(0, 8)}`;

    await insertAnnouncement({
      applicationId,
      isEnabled: true,
      publishDate: new Date(Date.now() + 60_000).toISOString(),
    });
    const latest = await insertAnnouncement({
      applicationId,
      isEnabled: true,
      publishDate: new Date(Date.now() + 120_000).toISOString(),
    });
    await insertAnnouncement({
      applicationId,
      isEnabled: false,
      publishDate: new Date(Date.now() + 180_000).toISOString(),
    });
    await insertAnnouncement({
      applicationId: otherApplicationId,
      isEnabled: true,
      publishDate: new Date(Date.now() + 240_000).toISOString(),
    });

    const result = await listAnnouncements({
      pool,
      applicationId,
      isEnabled: true,
      pagination: { limit: "20", offset: "0" },
    });

    expect(result.totalCount).toBe(2);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].id).toBe(latest.id);
    expect(
      result.data.every((item) => item.applicationId === applicationId),
    ).toBe(true);
    expect(result.data.every((item) => item.isEnabled)).toBe(true);
  });

  it("returns an announcement with both translations", async () => {
    const seeded = await insertAnnouncement();

    const result = await getAnnouncementById({
      pool,
      id: seeded.id,
    });

    expect(result.id).toBe(seeded.id);
    expect(result.applicationId).toBe(seeded.applicationId);
    expect(result.translations.en.title).toBe(
      `Announcement ${seeded.applicationId}`,
    );
    expect(result.translations.ga.title).toBe(`Fogra ${seeded.applicationId}`);
  });

  it("lists published enabled announcements and filters acknowledged rows", async () => {
    const profileId = randomUUID().substring(0, 12);
    const applicationId = `announcements-${randomUUID().substring(0, 8)}`;

    const acknowledged = await insertAnnouncement({
      applicationId,
      isEnabled: true,
      publishDate: new Date(Date.now() - 120_000).toISOString(),
    });
    const latest = await insertAnnouncement({
      applicationId,
      isEnabled: true,
      publishDate: new Date(Date.now() - 60_000).toISOString(),
    });
    await insertAnnouncement({
      applicationId,
      isEnabled: false,
      publishDate: new Date(Date.now() - 30_000).toISOString(),
    });
    await insertAnnouncement({
      applicationId,
      isEnabled: true,
      publishDate: new Date(Date.now() + 60_000).toISOString(),
    });

    await pool.query(
      `INSERT INTO announcement_acknowledgements (announcement_id, profile_id)
       VALUES ($1, $2)`,
      [acknowledged.id, profileId],
    );

    const allAnnouncements = await listCitizenAnnouncements({
      pool,
      profileId,
      applicationId,
      newOnly: false,
      pagination: { limit: "20", offset: "0" },
    });
    expect(allAnnouncements.totalCount).toBe(2);
    expect(allAnnouncements.data).toHaveLength(2);
    expect(allAnnouncements.data[0].id).toBe(latest.id);

    const newOnlyAnnouncements = await listCitizenAnnouncements({
      pool,
      profileId,
      applicationId,
      newOnly: true,
      pagination: { limit: "20", offset: "0" },
    });
    expect(newOnlyAnnouncements.totalCount).toBe(1);
    expect(newOnlyAnnouncements.data).toHaveLength(1);
    expect(newOnlyAnnouncements.data[0].id).toBe(latest.id);
  });

  it("does not treat a newer acknowledgement as covering older published announcements", async () => {
    const profileId = randomUUID().substring(0, 12);
    const applicationId = `announcements-${randomUUID().substring(0, 8)}`;

    const olderUnacknowledged = await insertAnnouncement({
      applicationId,
      isEnabled: true,
      publishDate: new Date(Date.now() - 120_000).toISOString(),
    });
    const newerAcknowledged = await insertAnnouncement({
      applicationId,
      isEnabled: true,
      publishDate: new Date(Date.now() - 60_000).toISOString(),
    });

    await pool.query(
      `INSERT INTO announcement_acknowledgements (announcement_id, profile_id)
       VALUES ($1, $2)`,
      [newerAcknowledged.id, profileId],
    );

    const newOnlyAnnouncements = await listCitizenAnnouncements({
      pool,
      profileId,
      applicationId,
      newOnly: true,
      pagination: { limit: "20", offset: "0" },
    });

    expect(newOnlyAnnouncements.totalCount).toBe(1);
    expect(newOnlyAnnouncements.data).toHaveLength(1);
    expect(newOnlyAnnouncements.data[0].id).toBe(olderUnacknowledged.id);
  });

  it("uses a single query for citizen announcement listing", async () => {
    const now = new Date("2026-04-28T00:00:00.000Z");
    const mockClient = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id: "announcement-1",
            applicationId: "messaging",
            isEnabled: true,
            publishDate: now,
            createdAt: now,
            createdBy: "seed-user",
            totalCount: "1",
            translations: {
              en: {
                id: "translation-en",
                announcementId: "announcement-1",
                language: "en",
                title: "Announcement",
                description: "English description",
                createdAt: now,
              },
              ga: {
                id: "translation-ga",
                announcementId: "announcement-1",
                language: "ga",
                title: "Fogra",
                description: "Cur sios",
                createdAt: now,
              },
            },
          },
        ],
      }),
    } as unknown as PoolClient;

    const result = await listCitizenAnnouncements({
      client: mockClient,
      profileId: "profile-1",
      applicationId: "messaging",
      newOnly: true,
      pagination: { limit: "20", offset: "0" },
    });

    expect(mockClient.query).toHaveBeenCalledTimes(1);
    expect(result.totalCount).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].translations.en.title).toBe("Announcement");
    expect(result.data[0].translations.ga.title).toBe("Fogra");
  });

  it("applies the first citizen profile details cutoff before acknowledgement filtering", async () => {
    const profileId = await insertProfile();
    const applicationId = `announcements-${randomUUID().substring(0, 8)}`;
    const now = Date.now();

    await insertProfileDetails({
      profileId,
      createdAt: new Date(now - 90_000).toISOString(),
      organisationId: null,
    });

    const acknowledgedBeforeCutoff = await insertAnnouncement({
      applicationId,
      isEnabled: true,
      publishDate: new Date(now - 120_000).toISOString(),
    });
    await insertAnnouncement({
      applicationId,
      isEnabled: true,
      publishDate: new Date(now - 110_000).toISOString(),
    });
    const acknowledgedAfterCutoff = await insertAnnouncement({
      applicationId,
      isEnabled: true,
      publishDate: new Date(now - 70_000).toISOString(),
    });
    const latestAfterCutoff = await insertAnnouncement({
      applicationId,
      isEnabled: true,
      publishDate: new Date(now - 60_000).toISOString(),
    });

    await pool.query(
      `INSERT INTO announcement_acknowledgements (announcement_id, profile_id)
       VALUES ($1, $3), ($2, $3)`,
      [acknowledgedBeforeCutoff.id, acknowledgedAfterCutoff.id, profileId],
    );

    const allAnnouncements = await listCitizenAnnouncements({
      pool,
      profileId,
      applicationId,
      newOnly: false,
      pagination: { limit: "20", offset: "0" },
    });
    expect(allAnnouncements.totalCount).toBe(2);
    expect(
      allAnnouncements.data.map((announcement) => announcement.id),
    ).toEqual([latestAfterCutoff.id, acknowledgedAfterCutoff.id]);

    const newOnlyAnnouncements = await listCitizenAnnouncements({
      pool,
      profileId,
      applicationId,
      newOnly: true,
      pagination: { limit: "20", offset: "0" },
    });
    expect(newOnlyAnnouncements.totalCount).toBe(1);
    expect(newOnlyAnnouncements.data).toHaveLength(1);
    expect(newOnlyAnnouncements.data[0].id).toBe(latestAfterCutoff.id);
  });

  it("falls back to the published-announcements behavior when no citizen profile details exist", async () => {
    const profileId = await insertProfile();
    const applicationId = `announcements-${randomUUID().substring(0, 8)}`;
    const visibleAnnouncement = await insertAnnouncement({
      applicationId,
      isEnabled: true,
      publishDate: new Date(Date.now() - 60_000).toISOString(),
    });

    await insertProfileDetails({
      profileId,
      createdAt: new Date(Date.now() - 120_000).toISOString(),
      organisationId: "org-1",
    });

    const announcements = await listCitizenAnnouncements({
      pool,
      profileId,
      applicationId,
      newOnly: false,
      pagination: { limit: "20", offset: "0" },
    });

    expect(announcements.totalCount).toBe(1);
    expect(announcements.data).toHaveLength(1);
    expect(announcements.data[0].id).toBe(visibleAnnouncement.id);
  });

  it("acknowledges announcements idempotently", async () => {
    const profileId = randomUUID().substring(0, 12);
    const applicationId = `announcements-${randomUUID().substring(0, 8)}`;
    const first = await insertAnnouncement({
      applicationId,
      isEnabled: true,
      publishDate: new Date(Date.now() - 120_000).toISOString(),
    });
    const second = await insertAnnouncement({
      applicationId,
      isEnabled: true,
      publishDate: new Date(Date.now() - 60_000).toISOString(),
    });

    const firstResult = await acknowledgeAnnouncements({
      pool,
      profileId,
      applicationId,
      announcementIds: [first.id, second.id],
      logger: mockLogger,
    });
    expect(firstResult.acknowledgedIds).toEqual([first.id, second.id]);

    const secondResult = await acknowledgeAnnouncements({
      pool,
      profileId,
      applicationId,
      announcementIds: [first.id, second.id],
      logger: mockLogger,
    });
    expect(secondResult.acknowledgedIds).toEqual([first.id, second.id]);

    const { rows } = await pool.query(
      `SELECT announcement_id
         FROM announcement_acknowledgements
        WHERE profile_id = $1`,
      [profileId],
    );
    expect(rows).toHaveLength(2);
  });

  it("rejects acknowledgement ids from another application", async () => {
    const profileId = randomUUID().substring(0, 12);
    const applicationId = `announcements-${randomUUID().substring(0, 8)}`;
    const otherApplicationId = `announcements-${randomUUID().substring(0, 8)}`;
    const other = await insertAnnouncement({
      applicationId: otherApplicationId,
      isEnabled: true,
      publishDate: new Date(Date.now() - 60_000).toISOString(),
    });

    await expect(
      acknowledgeAnnouncements({
        pool,
        profileId,
        applicationId,
        announcementIds: [other.id],
        logger: mockLogger,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("updates enabled state idempotently", async () => {
    const seeded = await insertAnnouncement({ isEnabled: true });

    const first = await setAnnouncementEnabled({
      pool,
      id: seeded.id,
      announcement: { isEnabled: false },
      logger: mockLogger,
    });
    expect(first.isEnabled).toBe(false);

    const second = await setAnnouncementEnabled({
      pool,
      id: seeded.id,
      announcement: { isEnabled: false },
      logger: mockLogger,
    });
    expect(second.isEnabled).toBe(false);

    const { rows } = await pool.query(
      "SELECT is_enabled FROM announcements WHERE id = $1",
      [seeded.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].is_enabled).toBe(false);
  });
});
