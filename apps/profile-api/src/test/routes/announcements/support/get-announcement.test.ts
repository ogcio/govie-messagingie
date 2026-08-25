import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { insertTestAnnouncement } from "~/test/insert-test-announcement.js";
import { buildOnce, type MockAuthConfig } from "~/test/test-server-builder.js";

const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);

describe("GET /api/v1/support/announcements/:id", async () => {
  let app: FastifyInstance;
  let setAuth: (config: MockAuthConfig) => void;
  const usedAnnouncementIds = new Set<string>();

  const seedAnnouncement = async (applicationId: string) => {
    const announcement = await insertTestAnnouncement(pool, {
      applicationId,
      publishDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdBy: "seed-user",
    });

    usedAnnouncementIds.add(announcement.id);
    return announcement;
  };

  beforeAll(async () => {
    const server = await buildOnce();
    app = server.app;
    setAuth = server.setAuth;
  });

  afterEach(async () => {
    const announcementIds = [...usedAnnouncementIds];
    if (announcementIds.length === 0) {
      return;
    }

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
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it("Returns 403 if logged in user is not an M2M application", async () => {
    setAuth({
      userId: randomUUID().substring(0, 12),
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/support/announcements/${randomUUID()}`,
    });

    expect(response.statusCode).toBe(403);
  });

  it("Returns 404 if announcement does not exist", async () => {
    setAuth({
      userId: randomUUID().substring(0, 12),
      isM2MApplication: true,
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/support/announcements/${randomUUID()}`,
    });

    expect(response.statusCode).toBe(404);
  });

  it("Returns the full announcement payload with translations", async () => {
    const applicationId = `announcements-${randomUUID().substring(0, 8)}`;
    const seeded = await seedAnnouncement(applicationId);

    setAuth({
      userId: randomUUID().substring(0, 12),
      isM2MApplication: true,
    });

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/support/announcements/${seeded.id}`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as {
      data: {
        id: string;
        applicationId: string;
        translations: {
          en: { title: string };
          ga: { title: string };
        };
      };
    };
    expect(body.data.id).toBe(seeded.id);
    expect(body.data.applicationId).toBe(applicationId);
    expect(body.data.translations.en.title).toBe(
      `Announcement ${applicationId}`,
    );
    expect(body.data.translations.ga.title).toBe(`Fogra ${applicationId}`);
  });
});
