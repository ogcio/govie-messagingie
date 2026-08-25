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

describe("POST /api/v1/citizens/announcements/acknowledgements", async () => {
  let app: FastifyInstance;
  let setAuth: (config: MockAuthConfig) => void;
  const usedAnnouncementIds = new Set<string>();

  const seedAnnouncement = async (params: {
    applicationId: string;
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

  it("Returns 403 when the user id is not set", async () => {
    setAuth({ userId: "" });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/citizens/announcements/acknowledgements",
      body: {
        applicationId: "messaging",
        announcementIds: [randomUUID()],
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it("Returns 422 when the request body is invalid", async () => {
    setAuth({ userId: randomUUID().substring(0, 12) });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/citizens/announcements/acknowledgements",
      body: {
        announcementIds: [],
      },
    });

    expect(response.statusCode).toBe(422);
  });

  it("Returns 400 when an announcement id does not belong to the requested application", async () => {
    const profileId = randomUUID().substring(0, 12);
    const applicationId = "profile";
    const otherApplicationId = "dashboard";
    const otherAnnouncement = await seedAnnouncement({
      applicationId: otherApplicationId,
      isEnabled: true,
      publishDate: new Date(Date.now() - 60_000).toISOString(),
    });

    setAuth({ userId: profileId });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/citizens/announcements/acknowledgements",
      body: {
        applicationId,
        announcementIds: [otherAnnouncement.id],
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("Acknowledges announcements idempotently and hides them from newOnly fetches", async () => {
    const profileId = randomUUID().substring(0, 12);
    const applicationId = "profile";
    const first = await seedAnnouncement({
      applicationId,
      isEnabled: true,
      publishDate: new Date(Date.now() - 120_000).toISOString(),
    });
    const second = await seedAnnouncement({
      applicationId,
      isEnabled: true,
      publishDate: new Date(Date.now() - 60_000).toISOString(),
    });

    setAuth({ userId: profileId });

    const firstResponse = await app.inject({
      method: "POST",
      url: "/api/v1/citizens/announcements/acknowledgements",
      body: {
        applicationId,
        announcementIds: [first.id, second.id],
      },
    });

    expect(firstResponse.statusCode).toBe(201);
    const firstBody = JSON.parse(firstResponse.body) as {
      data: { acknowledgedIds: string[] };
    };
    expect(firstBody.data.acknowledgedIds).toEqual([first.id, second.id]);

    const retryResponse = await app.inject({
      method: "POST",
      url: "/api/v1/citizens/announcements/acknowledgements",
      body: {
        applicationId,
        announcementIds: [first.id, second.id],
      },
    });

    expect(retryResponse.statusCode).toBe(201);
    const { rows } = await pool.query(
      `SELECT announcement_id
         FROM announcement_acknowledgements
        WHERE profile_id = $1`,
      [profileId],
    );
    expect(rows).toHaveLength(2);

    const newOnlyResponse = await app.inject({
      method: "GET",
      url: "/api/v1/citizens/announcements",
      query: {
        applicationId,
        newOnly: "true",
      },
    });

    expect(newOnlyResponse.statusCode).toBe(200);
    const newOnlyBody = JSON.parse(newOnlyResponse.body) as {
      data: Array<{ id: string }>;
      metadata: { totalCount: number };
    };
    expect(newOnlyBody.data).toHaveLength(0);
    expect(newOnlyBody.metadata.totalCount).toBe(0);
  });
});
