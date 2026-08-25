import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { LifecycleTaskTypes } from "~/schemas/data-lifecycle-tasks/index.js";

import { createProfile } from "~/services/profiles/sql/create-profile.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";

vi.mock("~/utils/audit-logger.js", () => ({
  AuditLogger: vi.fn().mockImplementation(() => ({
    sendLogs: vi.fn().mockResolvedValue(undefined),
  })),
}));

// import build after mocking to avoid hoisting issues
import { buildOnce, type MockAuthConfig } from "~/test/test-server-builder.js";

let app: FastifyInstance;
let setAuth: (config: MockAuthConfig) => void;

const getMockProfile = () => {
  const id = randomUUID().substring(0, 12);
  return {
    id,
    primaryUserId: id,
    publicName: randomUUID().substring(0, 13),
    firstName: randomUUID().substring(0, 10),
    lastName: randomUUID().substring(0, 10),
    email: `${randomUUID().substring(0, 10)}@example.com`,
  };
};

describe("POST - /api/v1/tasks - Delete profile task", async () => {
  const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
  let client: PoolClient;

  beforeAll(async () => {
    const server = await buildOnce();
    app = server.app;
    setAuth = server.setAuth;
  });

  afterAll(async () => {
    await pool.end();
    vi.resetAllMocks();
    if (app?.close) {
      await app.close();
    }
  });

  it("Citizen cannot invoke delete profile task for itself", async () => {
    client = await pool.connect();
    try {
      const mockProfile = getMockProfile();
      await createProfile(client, mockProfile);
      setAuth({ userId: mockProfile.id, isM2MApplication: false });

      const response = await app.inject({
        method: "POST",
        url: `/api/v1/lifecycle-tasks`,
        body: {
          type: LifecycleTaskTypes.DeleteProfile,
          profileId: mockProfile.id,
        },
      });
      expect(response.statusCode).toBe(401);
    } finally {
      client.release();
    }
  });

  it("Citizen cannot delete another user's profile", async () => {
    const profileId = randomUUID().substring(0, 12);
    setAuth({ userId: profileId, isM2MApplication: false });
    const anotherProfileId = randomUUID().substring(0, 12);

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/lifecycle-tasks`,
      body: {
        type: LifecycleTaskTypes.DeleteProfile,
        profileId: anotherProfileId,
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it("Cannot delete a child profile", async () => {
    client = await pool.connect();
    try {
      const mockProfile = getMockProfile();
      await createProfile(client, mockProfile);
      const childProfile = getMockProfile();
      childProfile.primaryUserId = mockProfile.id;
      await createProfile(client, childProfile);

      setAuth({ userId: childProfile.id, isM2MApplication: true });

      const response = await app.inject({
        method: "POST",
        url: `/api/v1/lifecycle-tasks`,
        body: {
          type: LifecycleTaskTypes.DeleteProfile,
          profileId: childProfile.id,
        },
      });

      expect(response.statusCode).toBe(400);
    } finally {
      client.release();
    }
  });

  it("M2M can invoke delete profile task for another profile", async () => {
    client = await pool.connect();
    try {
      const mockProfile = getMockProfile();
      await createProfile(client, mockProfile);
      setAuth({ userId: mockProfile.id, isM2MApplication: true });

      const response = await app.inject({
        method: "POST",
        url: `/api/v1/lifecycle-tasks`,
        body: {
          type: LifecycleTaskTypes.DeleteProfile,
          profileId: mockProfile.id,
        },
      });
      expect(response.statusCode).toBe(202);
    } finally {
      client.release();
    }
  });
});
