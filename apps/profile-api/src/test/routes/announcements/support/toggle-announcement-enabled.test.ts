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

describe("PATCH /api/v1/support/announcements/:id", async () => {
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
      method: "PATCH",
      url: `/api/v1/support/announcements/${randomUUID()}`,
      body: { isEnabled: "false" },
    });

    expect(response.statusCode).toBe(403);
  });

  it("Returns 404 if announcement does not exist", async () => {
    setAuth({
      userId: randomUUID().substring(0, 12),
      isM2MApplication: true,
    });

    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/support/announcements/${randomUUID()}`,
      body: { isEnabled: "false" },
    });

    expect(response.statusCode).toBe(404);
  });

  it("Updates enabled state idempotently and returns the updated record", async () => {
    const applicationId = `announcements-${randomUUID().substring(0, 8)}`;
    const seeded = await seedAnnouncement(applicationId);

    setAuth({
      userId: randomUUID().substring(0, 12),
      isM2MApplication: true,
    });

    const firstResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/support/announcements/${seeded.id}`,
      body: { isEnabled: "false" },
    });

    expect(firstResponse.statusCode).toBe(200);
    const firstBody = JSON.parse(firstResponse.body) as {
      data: {
        id: string;
        isEnabled: boolean;
        translations: {
          en: { title: string };
          ga: { title: string };
        };
      };
    };
    expect(firstBody.data.id).toBe(seeded.id);
    expect(firstBody.data.isEnabled).toBe(false);
    expect(firstBody.data.translations.en.title).toBe(
      `Announcement ${applicationId}`,
    );

    const secondResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/support/announcements/${seeded.id}`,
      body: { isEnabled: "false" },
    });

    expect(secondResponse.statusCode).toBe(200);
    const { rows } = await pool.query(
      "SELECT is_enabled FROM announcements WHERE id = $1",
      [seeded.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].is_enabled).toBe(false);
  });
});
