import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  acknowledgeAnnouncements,
  createAnnouncement,
  getAnnouncementById,
  listAnnouncements,
  setAnnouncementEnabled,
} from "~/services/announcements/announcements-service.js";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import { buildMockLogger } from "~/test/build-mock-logger.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { insertTestAnnouncement } from "~/test/insert-test-announcement.js";

const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
const { logger } = buildMockLogger({});
const profileId = randomUUID().substring(0, 12);

const buildTranslations = () => ({
  en: { title: "Maintenance", description: "Scheduled maintenance" },
  ga: { title: "Cothabháil", description: "Cothabháil sceidealta" },
});

// Announcements are only ever scoped by application id, so any suite asserting
// absolute counts over "profile" or "dashboard" sees the rows written here.
// Mint a private id per test to stay invisible to them.
const privateApplicationId = () =>
  `announcements-crud-${randomUUID().substring(0, 8)}`;

describe("announcements-service CRUD", () => {
  beforeAll(async () => {
    const client = await pool.connect();
    try {
      await createProfile(client, {
        id: profileId,
        primaryUserId: profileId,
        publicName: "Announcements User",
        email: `${profileId}@example.com`,
      });
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    if (!pool.ended) {
      await pool.end();
    }
  });

  describe("createAnnouncement", () => {
    it("creates an announcement with both translations", async () => {
      const created = await createAnnouncement({
        pool,
        logger,
        loggedInUserId: profileId,
        announcement: {
          applicationId: "profile",
          isEnabled: true,
          publishDate: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          translations: buildTranslations(),
        },
      });
      expect(created.id).toBeDefined();

      const fetched = await getAnnouncementById({ pool, id: created.id });
      expect(fetched.applicationId).toBe("profile");
      expect(fetched.translations.en.title).toBe("Maintenance");
      expect(fetched.translations.ga.title).toBe("Cothabháil");
    });

    it("rejects an announcement missing a translation", async () => {
      await expect(
        createAnnouncement({
          pool,
          logger,
          loggedInUserId: null,
          announcement: {
            applicationId: "profile",
            isEnabled: true,
            publishDate: new Date().toISOString(),
            translations: { en: buildTranslations().en },
          },
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe("getAnnouncementById", () => {
    it("throws 404 for an unknown id", async () => {
      await expect(
        getAnnouncementById({ pool, id: randomUUID() }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe("listAnnouncements", () => {
    it("filters by applicationId and isEnabled with pagination", async () => {
      const applicationId = privateApplicationId();
      await insertTestAnnouncement(pool, {
        applicationId,
        publishDate: new Date(),
        isEnabled: true,
      });
      await insertTestAnnouncement(pool, {
        applicationId,
        publishDate: new Date(),
        isEnabled: false,
      });

      const enabled = await listAnnouncements({
        pool,
        applicationId,
        isEnabled: true,
        pagination: { limit: "10", offset: "0" },
      });
      expect(enabled.totalCount).toBe(1);
      for (const announcement of enabled.data) {
        expect(announcement.applicationId).toBe(applicationId);
        expect(announcement.isEnabled).toBe(true);
      }

      const paged = await listAnnouncements({
        pool,
        applicationId,
        pagination: { limit: "1", offset: "0" },
      });
      expect(paged.totalCount).toBe(2);
      expect(paged.data).toHaveLength(1);
    });

    it("returns empty data when nothing matches", async () => {
      const result = await listAnnouncements({
        pool,
        applicationId: privateApplicationId(),
        isEnabled: false,
        pagination: { limit: "10", offset: "0" },
      });
      expect(result.totalCount).toBe(0);
      expect(result.data).toHaveLength(0);
    });
  });

  describe("setAnnouncementEnabled", () => {
    it("disables and re-enables an announcement", async () => {
      const inserted = await insertTestAnnouncement(pool, {
        applicationId: privateApplicationId(),
        publishDate: new Date(),
        isEnabled: true,
      });

      const disabled = await setAnnouncementEnabled({
        pool,
        logger,
        id: inserted.id,
        announcement: { isEnabled: false },
      });
      expect(disabled.isEnabled).toBe(false);
      expect(disabled.translations.en).toBeDefined();
    });

    it("throws 404 for an unknown announcement", async () => {
      await expect(
        setAnnouncementEnabled({
          pool,
          logger,
          id: randomUUID(),
          announcement: { isEnabled: false },
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe("acknowledgeAnnouncements", () => {
    it("acknowledges announcements and dedupes ids", async () => {
      const applicationId = privateApplicationId();
      const inserted = await insertTestAnnouncement(pool, {
        applicationId,
        publishDate: new Date(),
        isEnabled: true,
      });

      const result = await acknowledgeAnnouncements({
        pool,
        logger,
        profileId,
        applicationId,
        announcementIds: [inserted.id, inserted.id],
      });
      expect(result.acknowledgedIds).toEqual([inserted.id]);

      // acknowledging again is a no-op thanks to ON CONFLICT
      const repeat = await acknowledgeAnnouncements({
        pool,
        logger,
        profileId,
        applicationId,
        announcementIds: [inserted.id],
      });
      expect(repeat.acknowledgedIds).toEqual([inserted.id]);
    });

    it("rejects ids that do not belong to the application", async () => {
      await expect(
        acknowledgeAnnouncements({
          pool,
          logger,
          profileId,
          applicationId: privateApplicationId(),
          announcementIds: [randomUUID()],
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });
});
