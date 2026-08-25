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

describe("GET /api/v1/citizens/announcements", async () => {
  let app: FastifyInstance;
  let setAuth: (config: MockAuthConfig) => void;
  const usedAnnouncementIds = new Set<string>();
  const usedProfileIds = new Set<string>();

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

  beforeAll(async () => {
    const server = await buildOnce();
    app = server.app;
    setAuth = server.setAuth;
  });

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
    if (app) {
      await app.close();
    }
  });

  it("Returns 403 when the user id is not set", async () => {
    setAuth({ userId: "" });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/citizens/announcements?applicationId=messaging",
    });

    expect(response.statusCode).toBe(403);
  });

  it("Returns 422 if applicationId is missing", async () => {
    setAuth({ userId: randomUUID().substring(0, 12) });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/citizens/announcements",
    });

    expect(response.statusCode).toBe(422);
  });

  it("Returns 422 if applicationId is invalid", async () => {
    setAuth({ userId: randomUUID().substring(0, 12) });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/citizens/announcements",
      query: {
        applicationId: "invalid-app",
      },
    });

    expect(response.statusCode).toBe(422);
  });

  it("Returns published enabled announcements sorted by publishDate desc", async () => {
    const profileId = randomUUID().substring(0, 12);
    const applicationId = "messaging";

    await seedAnnouncement({
      applicationId,
      isEnabled: true,
      publishDate: new Date(Date.now() - 120_000).toISOString(),
    });
    const latest = await seedAnnouncement({
      applicationId,
      isEnabled: true,
      publishDate: new Date(Date.now() - 60_000).toISOString(),
    });
    await seedAnnouncement({
      applicationId,
      isEnabled: false,
      publishDate: new Date(Date.now() - 30_000).toISOString(),
    });
    await seedAnnouncement({
      applicationId,
      isEnabled: true,
      publishDate: new Date(Date.now() + 60_000).toISOString(),
    });

    setAuth({ userId: profileId });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/citizens/announcements",
      query: {
        applicationId,
        limit: "1",
        offset: "0",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as {
      data: Array<{ id: string; translations: { en: { title: string } } }>;
      metadata: { totalCount: number };
    };
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(latest.id);
    expect(body.data[0].translations.en.title).toBe(
      `Announcement ${applicationId}`,
    );
    expect(body.metadata.totalCount).toBe(2);
  });

  it("Filters acknowledged announcements out when newOnly=true", async () => {
    const profileId = randomUUID().substring(0, 12);
    const applicationId = "messaging";

    const acknowledged = await seedAnnouncement({
      applicationId,
      isEnabled: true,
      publishDate: new Date(Date.now() - 120_000).toISOString(),
    });
    const unseen = await seedAnnouncement({
      applicationId,
      isEnabled: true,
      publishDate: new Date(Date.now() - 60_000).toISOString(),
    });

    await pool.query(
      `INSERT INTO announcement_acknowledgements (announcement_id, profile_id)
       VALUES ($1, $2)`,
      [acknowledged.id, profileId],
    );

    setAuth({ userId: profileId });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/citizens/announcements",
      query: {
        applicationId,
        newOnly: "true",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as {
      data: Array<{ id: string }>;
      metadata: { totalCount: number };
    };
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(unseen.id);
    expect(body.metadata.totalCount).toBe(1);
  });

  it("Does not treat a newer acknowledgement as hiding older published announcements", async () => {
    const profileId = randomUUID().substring(0, 12);
    const applicationId = "messaging";

    const olderUnacknowledged = await seedAnnouncement({
      applicationId,
      isEnabled: true,
      publishDate: new Date(Date.now() - 120_000).toISOString(),
    });
    const newerAcknowledged = await seedAnnouncement({
      applicationId,
      isEnabled: true,
      publishDate: new Date(Date.now() - 60_000).toISOString(),
    });

    await pool.query(
      `INSERT INTO announcement_acknowledgements (announcement_id, profile_id)
       VALUES ($1, $2)`,
      [newerAcknowledged.id, profileId],
    );

    setAuth({ userId: profileId });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/citizens/announcements",
      query: {
        applicationId,
        newOnly: "true",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as {
      data: Array<{ id: string }>;
      metadata: { totalCount: number };
    };
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(olderUnacknowledged.id);
    expect(body.metadata.totalCount).toBe(1);
  });

  it("Only returns announcements published after the first citizen profile details row", async () => {
    const profileId = await insertProfile();
    const applicationId = "messaging";
    const now = Date.now();

    await insertProfileDetails({
      profileId,
      createdAt: new Date(now - 90_000).toISOString(),
      organisationId: null,
    });

    await seedAnnouncement({
      applicationId,
      isEnabled: true,
      publishDate: new Date(now - 120_000).toISOString(),
    });
    const visible = await seedAnnouncement({
      applicationId,
      isEnabled: true,
      publishDate: new Date(now - 60_000).toISOString(),
    });

    setAuth({ userId: profileId });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/citizens/announcements",
      query: {
        applicationId,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as {
      data: Array<{ id: string }>;
      metadata: { totalCount: number };
    };
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(visible.id);
    expect(body.metadata.totalCount).toBe(1);
  });

  it("Applies the cutoff before newOnly acknowledgement filtering", async () => {
    const profileId = await insertProfile();
    const applicationId = "messaging";
    const now = Date.now();

    await insertProfileDetails({
      profileId,
      createdAt: new Date(now - 90_000).toISOString(),
      organisationId: null,
    });

    const acknowledgedBeforeCutoff = await seedAnnouncement({
      applicationId,
      isEnabled: true,
      publishDate: new Date(now - 120_000).toISOString(),
    });
    await seedAnnouncement({
      applicationId,
      isEnabled: true,
      publishDate: new Date(now - 110_000).toISOString(),
    });
    const acknowledgedAfterCutoff = await seedAnnouncement({
      applicationId,
      isEnabled: true,
      publishDate: new Date(now - 70_000).toISOString(),
    });
    const visibleAfterCutoff = await seedAnnouncement({
      applicationId,
      isEnabled: true,
      publishDate: new Date(now - 60_000).toISOString(),
    });

    await pool.query(
      `INSERT INTO announcement_acknowledgements (announcement_id, profile_id)
       VALUES ($1, $3), ($2, $3)`,
      [acknowledgedBeforeCutoff.id, acknowledgedAfterCutoff.id, profileId],
    );

    setAuth({ userId: profileId });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/citizens/announcements",
      query: {
        applicationId,
        newOnly: "true",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as {
      data: Array<{ id: string }>;
      metadata: { totalCount: number };
    };
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(visibleAfterCutoff.id);
    expect(body.metadata.totalCount).toBe(1);
  });

  it("Falls back to current published behavior when no citizen profile details row exists", async () => {
    const profileId = await insertProfile();
    const applicationId = "messaging";
    const visible = await seedAnnouncement({
      applicationId,
      isEnabled: true,
      publishDate: new Date(Date.now() - 60_000).toISOString(),
    });

    await insertProfileDetails({
      profileId,
      createdAt: new Date(Date.now() - 120_000).toISOString(),
      organisationId: "org-1",
    });

    setAuth({ userId: profileId });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/citizens/announcements",
      query: {
        applicationId,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as {
      data: Array<{ id: string }>;
      metadata: { totalCount: number };
    };
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(visible.id);
    expect(body.metadata.totalCount).toBe(1);
  });
});
