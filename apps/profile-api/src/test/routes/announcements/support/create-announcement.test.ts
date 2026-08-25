import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { CreateAnnouncement } from "~/schemas/announcements/support.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { buildOnce, type MockAuthConfig } from "~/test/test-server-builder.js";

const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);

describe("POST /api/v1/support/announcements", async () => {
  let app: FastifyInstance;
  let setAuth: (config: MockAuthConfig) => void;
  const usedAnnouncementIds = new Set<string>();

  const buildPayload = (
    applicationId: CreateAnnouncement["applicationId"],
  ): CreateAnnouncement => ({
    applicationId,
    isEnabled: "true",
    publishDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    translations: {
      en: {
        title: `Announcement ${applicationId}`,
        description: `English description for ${applicationId}`,
      },
      ga: {
        title: `Fogra ${applicationId}`,
        description: `Cur sios Gaeilge do ${applicationId}`,
      },
    },
  });

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

  it("Returns 403 if logged in user is a public servant", async () => {
    const applicationId = "profile";
    setAuth({
      userId: randomUUID().substring(0, 12),
      organizationId: "organisationId",
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/support/announcements",
      body: buildPayload(applicationId),
    });

    expect(response.statusCode).toBe(403);
  });

  it("Returns 403 if logged in user is not an M2M application", async () => {
    const applicationId = "profile";
    setAuth({
      userId: randomUUID().substring(0, 12),
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/support/announcements",
      body: buildPayload(applicationId),
    });

    expect(response.statusCode).toBe(403);
  });

  it("Returns 422 if required translations are missing", async () => {
    const applicationId = "profile";
    setAuth({
      userId: randomUUID().substring(0, 12),
      isM2MApplication: true,
    });

    const payload = buildPayload(applicationId);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/support/announcements",
      body: {
        ...payload,
        translations: {
          en: payload.translations.en,
        },
      },
    });

    expect(response.statusCode).toBe(422);
  });

  it("Returns 422 if applicationId is invalid", async () => {
    setAuth({
      userId: randomUUID().substring(0, 12),
      isM2MApplication: true,
    });

    const payload = buildPayload("profile");
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/support/announcements",
      body: {
        ...payload,
        applicationId: "invalid-app",
      },
    });

    expect(response.statusCode).toBe(422);
  });

  it("Returns 422 if publishDate is missing", async () => {
    const applicationId = "profile";
    setAuth({
      userId: randomUUID().substring(0, 12),
      isM2MApplication: true,
    });

    const payload = buildPayload(applicationId);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/support/announcements",
      body: {
        ...payload,
        publishDate: undefined,
      },
    });

    expect(response.statusCode).toBe(422);
  });

  it("Creates an announcement with both translations", async () => {
    const applicationId = "profile";
    const m2mUserId = randomUUID().substring(0, 12);
    const payload = buildPayload(applicationId);

    setAuth({
      userId: m2mUserId,
      isM2MApplication: true,
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/support/announcements",
      body: payload,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as { data: { id: string } };
    expect(body.data.id).toBeDefined();
    usedAnnouncementIds.add(body.data.id);

    const { rows: announcementRows } = await pool.query(
      `SELECT application_id, is_enabled, publish_date, created_by
         FROM announcements
        WHERE id = $1`,
      [body.data.id],
    );
    expect(announcementRows).toHaveLength(1);
    expect(announcementRows[0].application_id).toBe(applicationId);
    expect(announcementRows[0].is_enabled).toBe(true);
    expect(announcementRows[0].publish_date.toISOString()).toBe(
      payload.publishDate,
    );
    expect(announcementRows[0].created_by).toBe(m2mUserId);

    const { rows: translationRows } = await pool.query(
      `SELECT language, title, description
         FROM announcement_translations
        WHERE announcement_id = $1`,
      [body.data.id],
    );
    expect(translationRows).toHaveLength(2);
    expect(translationRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          language: "en",
          title: payload.translations.en.title,
          description: payload.translations.en.description,
        }),
        expect.objectContaining({
          language: "ga",
          title: payload.translations.ga.title,
          description: payload.translations.ga.description,
        }),
      ]),
    );
  });
});
