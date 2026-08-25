import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { AnnouncementApplicationId } from "~/schemas/announcements/shared.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { insertTestAnnouncement } from "~/test/insert-test-announcement.js";
import { buildOnce, type MockAuthConfig } from "~/test/test-server-builder.js";

const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);

describe("GET /api/v1/support/announcements", async () => {
  let app: FastifyInstance;
  let setAuth: (config: MockAuthConfig) => void;
  const usedAnnouncementIds = new Set<string>();

  const seedAnnouncement = async (params: {
    applicationId: AnnouncementApplicationId;
    isEnabled: boolean;
    publishDate: string;
  }) => {
    const announcement = await insertTestAnnouncement(pool, {
      applicationId: params.applicationId,
      isEnabled: params.isEnabled,
      publishDate: new Date(params.publishDate),
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
      url: "/api/v1/support/announcements",
    });

    expect(response.statusCode).toBe(403);
  });

  it("Returns 422 for an invalid isEnabled filter", async () => {
    setAuth({
      userId: randomUUID().substring(0, 12),
      isM2MApplication: true,
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/support/announcements",
      query: { isEnabled: "maybe" },
    });

    expect(response.statusCode).toBe(422);
  });

  it("Returns paginated announcements filtered by applicationId and isEnabled", async () => {
    const applicationId = "dashboard";
    const otherApplicationId = "messaging";

    await seedAnnouncement({
      applicationId,
      isEnabled: true,
      publishDate: new Date(Date.now() + 60_000).toISOString(),
    });
    const latest = await seedAnnouncement({
      applicationId,
      isEnabled: true,
      publishDate: new Date(Date.now() + 120_000).toISOString(),
    });
    await seedAnnouncement({
      applicationId,
      isEnabled: false,
      publishDate: new Date(Date.now() + 180_000).toISOString(),
    });
    await seedAnnouncement({
      applicationId: otherApplicationId,
      isEnabled: true,
      publishDate: new Date(Date.now() + 240_000).toISOString(),
    });

    setAuth({
      userId: randomUUID().substring(0, 12),
      isM2MApplication: true,
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/support/announcements",
      query: {
        applicationId,
        isEnabled: "true",
        limit: "1",
        offset: "0",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as {
      data: Array<{ id: string; applicationId: string; isEnabled: boolean }>;
      metadata: { totalCount: number };
    };
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(latest.id);
    expect(body.data[0].applicationId).toBe(applicationId);
    expect(body.data[0].isEnabled).toBe(true);
    expect(body.metadata.totalCount).toBe(2);
  });
});
