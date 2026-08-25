import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { handleGetMany } from "~/routes/lifecycle-tasks/index.js";
import type { GetManyLifecycleTaskSchema } from "~/schemas/data-lifecycle-tasks/get-many-user-export.js";
import type { FastifyRequestTypebox } from "~/schemas/shared.js";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";

const stubServer = {
  checkPermissions: (
    _request: FastifyRequest,
    _reply: FastifyReply,
    _permissions: string[],
    _matchConfig?: { method: "AND" | "OR" },
  ) => {},
} as unknown as FastifyInstance;

describe("GET - /api/v1/lifecycle-tasks (handler)", () => {
  const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("returns lifecycle tasks for a valid user", async () => {
    const idProfile = randomUUID().substring(0, 12);
    const client = await pool.connect();
    let id: string;
    try {
      await createProfile(client, {
        email: `${randomUUID().substring(0, 5)}@example.com`,
        id: idProfile,
        primaryUserId: idProfile,
        publicName: "A B",
      });

      const queryRes = await client.query(
        `
        insert into data_lifecycle_tasks(task_type, status, metadata, profile_id, scheduled_at) 
        values('export_user_data', 'pending', '{"expiresAt": "2026-02-09T15:04:05.000Z"}', $1, now())
        returning id`,
        [idProfile],
      );
      id = queryRes.rows.at(0).id;
    } finally {
      client.release();
    }

    const handler = handleGetMany(pool);

    const result = await handler({
      userData: {
        userId: idProfile,
        isM2MApplication: false,
        organizationId: undefined,
      },
      body: {
        profileId: idProfile,
      },
      server: stubServer,
    } as FastifyRequestTypebox<typeof GetManyLifecycleTaskSchema>);

    expect(result).toEqual({
      data: {
        tasks: [
          {
            id,
            type: "export_user_data",
            status: "pending",
            metadata: { expiresAt: "2026-02-09T15:04:05.000Z" },
          },
        ],
      },
    });
  });

  it("returns lifecycle tasks for a specific type - profileId set", async () => {
    const idProfile = randomUUID().substring(0, 12);
    const client = await pool.connect();
    let id: string;
    const customType = randomUUID().substring(0, 8);

    try {
      await createProfile(client, {
        email: `${randomUUID().substring(0, 5)}@example.com`,
        id: idProfile,
        primaryUserId: idProfile,
        publicName: "A B",
      });
      const queryRes = await client.query(
        `
        insert into data_lifecycle_tasks(task_type, status, metadata, profile_id, scheduled_at) 
        values($2, 'pending', '{"expiresAt": "2026-02-09T15:04:05.000Z"}', $1, now())
        returning id`,
        [idProfile, customType],
      );
      id = queryRes.rows.at(0).id;
    } finally {
      client.release();
    }

    const handler = handleGetMany(pool);

    const result = await handler({
      userData: {
        userId: idProfile,
        isM2MApplication: false,
        organizationId: undefined,
      },
      body: {
        profileId: idProfile,
        taskType: customType,
      },
      server: stubServer,
    } as FastifyRequestTypebox<typeof GetManyLifecycleTaskSchema>);

    expect(result).toEqual({
      data: {
        tasks: [
          {
            id,
            type: customType,
            status: "pending",
            metadata: { expiresAt: "2026-02-09T15:04:05.000Z" },
          },
        ],
      },
    });
  });

  it("m2m - returns lifecycle tasks for a specific type - profileId not set", async () => {
    const idProfile = randomUUID().substring(0, 12);
    const secondProfileId = randomUUID().substring(0, 12);
    const client = await pool.connect();
    let id: string;
    let secondId: string;
    const customType = randomUUID().substring(0, 8);

    try {
      await createProfile(client, {
        email: `${randomUUID().substring(0, 5)}@example.com`,
        id: idProfile,
        primaryUserId: idProfile,
        publicName: "A B",
      });
      await createProfile(client, {
        email: `${randomUUID().substring(0, 5)}@example.com`,
        id: secondProfileId,
        primaryUserId: secondProfileId,
        publicName: "A BC",
      });
      const queryRes = await client.query(
        `
        insert into data_lifecycle_tasks(task_type, status, metadata, profile_id, scheduled_at) 
        values($2, 'pending', '{"expiresAt": "2026-02-09T15:04:05.000Z"}', $1, now())
        returning id`,
        [idProfile, customType],
      );
      id = queryRes.rows.at(0).id;
      const secondQueryRes = await client.query(
        `
        insert into data_lifecycle_tasks(task_type, status, metadata, profile_id, scheduled_at) 
        values($2, 'pending', '{"expiresAt": "2026-02-09T15:04:05.000Z"}', $1, now())
        returning id`,
        [secondProfileId, customType],
      );
      secondId = secondQueryRes.rows.at(0).id;
    } finally {
      client.release();
    }

    const handler = handleGetMany(pool);

    const result = await handler({
      userData: {
        userId: idProfile,
        isM2MApplication: true,
        organizationId: undefined,
      },
      body: {
        taskType: customType,
      },
      server: stubServer,
    } as FastifyRequestTypebox<typeof GetManyLifecycleTaskSchema>);

    expect(result.data.tasks).toEqual([
      {
        id: secondId,
        type: customType,
        status: "pending",
        metadata: { expiresAt: "2026-02-09T15:04:05.000Z" },
      },
      {
        id,
        type: customType,
        status: "pending",
        metadata: { expiresAt: "2026-02-09T15:04:05.000Z" },
      },
    ]);
  });

  it("citizen - throw if profileId not set", async () => {
    const handler = handleGetMany(pool);
    const id = randomUUID().substring(0, 12);
    const result = handler({
      userData: {
        userId: id,
        isM2MApplication: false,
        organizationId: undefined,
      },
      body: {},
      server: stubServer,
    } as FastifyRequestTypebox<typeof GetManyLifecycleTaskSchema>);

    await expect(result).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("throws 403 if userData is missing", async () => {
    const handler = handleGetMany(pool);

    await expect(
      handler(
        {} as unknown as FastifyRequestTypebox<
          typeof GetManyLifecycleTaskSchema
        >,
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("accepts m2m", async () => {
    const handler = handleGetMany(pool);

    const response = await handler({
      userData: {
        userId: "user-1",
        isM2MApplication: true,
      },
      server: stubServer,
      body: {},
    } as FastifyRequestTypebox<typeof GetManyLifecycleTaskSchema>);

    expect(response.data.tasks).toBeDefined();
  });

  it("throws 403 when organizationId is present", async () => {
    const handler = handleGetMany(pool);

    await expect(
      handler({
        userData: {
          userId: "user-1",
          isM2MApplication: false,
          organizationId: "org-1",
        },
        server: stubServer,
      } as FastifyRequestTypebox<typeof GetManyLifecycleTaskSchema>),
    ).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("throws 403 when profileId query is not same as auth userId for citizen", async () => {
    const idProfile = randomUUID().substring(0, 12);
    const client = await pool.connect();

    try {
      await createProfile(client, {
        email: `${randomUUID().substring(0, 5)}@example.com`,
        id: idProfile,
        primaryUserId: idProfile,
        publicName: "A B",
      });
    } finally {
      client.release();
    }

    const handler = handleGetMany(pool);

    await expect(
      handler({
        userData: {
          userId: idProfile,
          isM2MApplication: false,
          organizationId: "org-1",
        },
        body: {
          profileId: "cheater",
        },
        server: stubServer,
      } as FastifyRequestTypebox<typeof GetManyLifecycleTaskSchema>),
    ).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("returns empty lifecycle tasks when no tasks exists", async () => {
    const idProfile = randomUUID().substring(0, 12);
    const client = await pool.connect();

    try {
      await createProfile(client, {
        email: `${randomUUID().substring(0, 5)}@example.com`,
        id: idProfile,
        primaryUserId: idProfile,
        publicName: "A B",
      });
    } finally {
      client.release();
    }

    const handler = handleGetMany(pool);

    const result = await handler({
      userData: {
        userId: idProfile,
        isM2MApplication: false,
        organizationId: undefined,
      },
      body: {
        profileId: idProfile,
      },
      server: stubServer,
    } as FastifyRequestTypebox<typeof GetManyLifecycleTaskSchema>);

    expect(result.data).toEqual({ tasks: [] });
  });

  it("throws 500 when getTasks throws", async () => {
    const mockPool = {
      body: vi.fn().mockRejectedValue(new Error("db on fire")),
    } as unknown as Pool;

    const handler = handleGetMany(mockPool);

    await expect(
      handler({
        userData: {
          userId: "user-1",
          isM2MApplication: false,
        },
        body: {
          profileId: "user-1",
        },
        server: stubServer,
      } as FastifyRequestTypebox<typeof GetManyLifecycleTaskSchema>),
    ).rejects.toMatchObject({
      statusCode: 500,
    });
  });
});
