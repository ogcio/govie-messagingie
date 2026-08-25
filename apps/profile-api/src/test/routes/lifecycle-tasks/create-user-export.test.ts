import { randomUUID } from "node:crypto";
import type { BuildingBlocksSDK } from "@ogcio/building-blocks-sdk";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { handleCreate } from "~/routes/lifecycle-tasks/index.js";
import type { CreateLifecycleTaskSchema } from "~/schemas/data-lifecycle-tasks/create-user-export.js";
import type {
  FastifyReplyTypebox,
  FastifyRequestTypebox,
} from "~/schemas/shared.js";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import {
  type AuditLogInput,
  AuditLogResourceTypes,
} from "~/types/audit-logger.js";
import { AuditLogger } from "~/utils/audit-logger.js";

const auditLogEntries: AuditLogInput[] = [];
const stubServer = {
  checkPermissions: (
    _request: FastifyRequest,
    _reply: FastifyReply,
    _permissions: string[],
    _matchConfig?: { method: "AND" | "OR" },
  ) => {},
} as unknown as FastifyInstance;

const mockAuditCollector = {
  sendLogs: vi.fn(async (logs: AuditLogInput[]) => {
    auditLogEntries.push(...logs);
    const toReturn = logs.map((_log) => ({ id: randomUUID() }));
    return { data: toReturn };
  }),
};
const getMockAuditLogger = (userId: string) =>
  new AuditLogger(
    mockAuditCollector as unknown as BuildingBlocksSDK["auditCollector"],
    {
      user_id: userId,
      client_timestamp: new Date().toISOString(),
      metadata: { default: "metadata" },
      resource_type: AuditLogResourceTypes.LifecycleTask,
      action_type: "create",
    },
  );

describe("POST - /api/v1/lifecycle-tasks (handler)", () => {
  const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);

  afterEach(() => {
    auditLogEntries.length = 0;
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates a lifecycle task for a valid user", async () => {
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
    const auditLogger = getMockAuditLogger(idProfile);
    const handler = handleCreate(pool, auditLogger);

    const result = await handler(
      {
        userData: {
          userId: idProfile,
          isM2MApplication: false,
          organizationId: undefined,
        },
        body: {
          type: "export_user_data",
          profileId: idProfile,
        },
        server: stubServer,
      } as unknown as FastifyRequestTypebox<typeof CreateLifecycleTaskSchema>,
      {} as unknown as FastifyReplyTypebox<typeof CreateLifecycleTaskSchema>,
    );

    expect(result).toEqual({
      data: {
        id: expect.any(String),
      },
    });

    // optional sanity check: row actually exists
    const { rows } = await pool.query(
      `select * from data_lifecycle_tasks where profile_id = $1`,
      [idProfile],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      task_type: "export_user_data",
      status: "pending",
      profile_id: idProfile,
    });

    expect(auditLogEntries).toHaveLength(1);
    expect(auditLogEntries[0]).toMatchObject({
      user_id: idProfile,
      resource_type: AuditLogResourceTypes.LifecycleTask,
      action_type: "create",
      resource_id: result.data.id,
      metadata: { default: "metadata" },
    });
  });

  it("throws 403 if userData is missing", async () => {
    const handler = handleCreate(pool, getMockAuditLogger("test-user"));
    await expect(
      handler(
        {
          server: stubServer,
        } as unknown as FastifyRequestTypebox<typeof CreateLifecycleTaskSchema>,
        {} as unknown as FastifyReplyTypebox<typeof CreateLifecycleTaskSchema>,
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("creates an export task for an M2M application and records the application as requester", async () => {
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

    const handler = handleCreate(pool, getMockAuditLogger(idProfile));

    const result = await handler(
      {
        userData: {
          userId: "support-app-1",
          isM2MApplication: true,
          organizationId: undefined,
        },
        body: {
          type: "export_user_data",
          profileId: idProfile,
          requesterUserId: "support-agent-1",
        },
        server: stubServer,
      } as unknown as FastifyRequestTypebox<typeof CreateLifecycleTaskSchema>,
      {} as unknown as FastifyReplyTypebox<typeof CreateLifecycleTaskSchema>,
    );

    expect(result.data.id).toEqual(expect.any(String));

    const { rows } = await pool.query(
      `SELECT * FROM data_lifecycle_tasks WHERE profile_id = $1 AND task_type = $2`,
      [idProfile, "export_user_data"],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      task_type: "export_user_data",
      status: "pending",
      requester_application_id: "support-app-1",
      requester_user_id: "support-agent-1",
    });
  });

  it("throws 401 for an M2M application without platform write permission", async () => {
    const denyingServer = {
      checkPermissions: () => {
        throw new Error("denied");
      },
    } as unknown as FastifyInstance;

    const handler = handleCreate(pool, getMockAuditLogger("user-1"));

    await expect(
      handler(
        {
          userData: {
            userId: "user-1",
            isM2MApplication: true,
          },
          body: {
            type: "export_user_data",
            profileId: "user-1",
          },
          server: denyingServer,
        } as unknown as FastifyRequestTypebox<typeof CreateLifecycleTaskSchema>,
        {} as unknown as FastifyReplyTypebox<typeof CreateLifecycleTaskSchema>,
      ),
    ).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("throws 403 when organizationId is present", async () => {
    const handler = handleCreate(pool, getMockAuditLogger("user-1"));

    await expect(
      handler(
        {
          userData: {
            userId: "user-1",
            isM2MApplication: false,
            organizationId: "org-1",
          },
          body: {
            type: "export_user_data",
          },
          server: stubServer,
        } as unknown as FastifyRequestTypebox<typeof CreateLifecycleTaskSchema>,
        {} as unknown as FastifyReplyTypebox<typeof CreateLifecycleTaskSchema>,
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("throws 403 when req.body.profileId mismatch the auth profileId", async () => {
    const handler = handleCreate(pool, getMockAuditLogger("user-1"));

    await expect(
      handler(
        {
          userData: {
            userId: "user-1",
            isM2MApplication: false,
            organizationId: "org-1",
          },
          body: {
            type: "export_user_data",
            profileId: "user-2",
          },
          server: stubServer,
        } as unknown as FastifyRequestTypebox<typeof CreateLifecycleTaskSchema>,
        {} as unknown as FastifyReplyTypebox<typeof CreateLifecycleTaskSchema>,
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("throws 500 when createLifecycleTask throws", async () => {
    const mockPool = {
      connect: vi.fn().mockResolvedValue({
        query: vi.fn().mockRejectedValueOnce(new Error("db on fire")),
        release: vi.fn(),
      }),
    } as unknown as Pool;

    const handler = handleCreate(mockPool, getMockAuditLogger("user-1"));

    await expect(
      handler(
        {
          userData: {
            userId: "user-1",
            isM2MApplication: false,
          },
          body: {
            type: "export_user_data",
            profileId: "user-1",
          },
          server: stubServer,
        } as unknown as FastifyRequestTypebox<typeof CreateLifecycleTaskSchema>,
        {} as unknown as FastifyReplyTypebox<typeof CreateLifecycleTaskSchema>,
      ),
    ).rejects.toThrow("db on fire");
  });

  it("does not reset task before expiry", async () => {
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

    const handler = handleCreate(pool, getMockAuditLogger(idProfile));

    // First call creates the task
    const first = await handler(
      {
        userData: {
          userId: idProfile,
          isM2MApplication: false,
          organizationId: undefined,
        },
        body: { type: "export_user_data", profileId: idProfile },
        server: stubServer,
      } as unknown as FastifyRequestTypebox<typeof CreateLifecycleTaskSchema>,
      {} as unknown as FastifyReplyTypebox<typeof CreateLifecycleTaskSchema>,
    );

    expect(first.data.id).toEqual(expect.any(String));

    // Second call before expiry should throw
    await expect(
      handler(
        {
          userData: {
            userId: idProfile,
            isM2MApplication: false,
            organizationId: undefined,
          },
          body: { type: "export_user_data", profileId: idProfile },
          server: stubServer,
        } as unknown as FastifyRequestTypebox<typeof CreateLifecycleTaskSchema>,
        {} as unknown as FastifyReplyTypebox<typeof CreateLifecycleTaskSchema>,
      ),
    ).rejects.toThrow("task can not be reset before expiry");

    // Verify DB still has only one row
    const { rows } = await pool.query(
      `SELECT * FROM data_lifecycle_tasks WHERE profile_id = $1 AND task_type = $2`,
      [idProfile, "export_user_data"],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("pending"); // not modified by second call
  });

  it("resets task when existing failed task exists", async () => {
    const idProfile = randomUUID().substring(0, 12);
    const client = await pool.connect();

    try {
      await createProfile(client, {
        email: `${randomUUID().substring(0, 5)}@example.com`,
        id: idProfile,
        primaryUserId: idProfile,
        publicName: "A B",
      });

      await client.query(
        `
        INSERT INTO data_lifecycle_tasks 
        (task_type, profile_id, scheduled_at, status, metadata)
        VALUES ('export_user_data', $1, now(), 'failed', '{}'::jsonb)
        RETURNING id
        `,
        [idProfile],
      );
    } finally {
      client.release();
    }

    const handler = handleCreate(pool, getMockAuditLogger(idProfile));

    // Call handler twice with same profile & type
    await handler(
      {
        userData: {
          userId: idProfile,
          isM2MApplication: false,
          organizationId: undefined,
        },
        body: { type: "export_user_data", profileId: idProfile },
        server: stubServer,
      } as unknown as FastifyRequestTypebox<typeof CreateLifecycleTaskSchema>,
      {} as unknown as FastifyReplyTypebox<typeof CreateLifecycleTaskSchema>,
    );

    // Query DB: only 1 row exists for this profile/type
    const { rows } = await pool.query(
      `SELECT * FROM data_lifecycle_tasks WHERE profile_id = $1 AND task_type = $2`,
      [idProfile, "export_user_data"],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      profile_id: idProfile,
      task_type: "export_user_data",
      status: "pending",
    });
  });

  it("updates task when existing expired task exists", async () => {
    const idProfile = randomUUID().substring(0, 12);
    const client = await pool.connect();

    try {
      await createProfile(client, {
        email: `${randomUUID().substring(0, 5)}@example.com`,
        id: idProfile,
        primaryUserId: idProfile,
        publicName: "A B",
      });

      await client.query(
        `
        INSERT INTO data_lifecycle_tasks 
        (task_type, profile_id, scheduled_at, status, metadata)
        VALUES ('export_user_data', $1, now() - interval '31 days', 'completed', '{}'::jsonb)
        RETURNING id
        `,
        [idProfile],
      );
    } finally {
      client.release();
    }

    const handler = handleCreate(pool, getMockAuditLogger(idProfile));

    // Call handler twice with same profile & type
    await handler(
      {
        userData: {
          userId: idProfile,
          isM2MApplication: false,
          organizationId: undefined,
        },
        body: { type: "export_user_data", profileId: idProfile },
        server: stubServer,
      } as unknown as FastifyRequestTypebox<typeof CreateLifecycleTaskSchema>,
      {} as unknown as FastifyReplyTypebox<typeof CreateLifecycleTaskSchema>,
    );

    // Query DB: only 1 row exists for this profile/type
    const { rows } = await pool.query(
      `SELECT * FROM data_lifecycle_tasks WHERE profile_id = $1 AND task_type = $2`,
      [idProfile, "export_user_data"],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      profile_id: idProfile,
      task_type: "export_user_data",
      status: "pending",
    });
  });

  it("lets an M2M application reset a task that is still within its validity window", async () => {
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

    const handler = handleCreate(pool, getMockAuditLogger(idProfile));

    // Citizen creates the first export; it is valid for 30 days.
    await handler(
      {
        userData: {
          userId: idProfile,
          isM2MApplication: false,
          organizationId: undefined,
        },
        body: { type: "export_user_data", profileId: idProfile },
        server: stubServer,
      } as unknown as FastifyRequestTypebox<typeof CreateLifecycleTaskSchema>,
      {} as unknown as FastifyReplyTypebox<typeof CreateLifecycleTaskSchema>,
    );

    // Mark it completed with an upload, as the worker would.
    await pool.query(
      `UPDATE data_lifecycle_tasks
       SET status = 'completed',
           metadata = metadata || '{"uploadId":"old-upload-id"}'::jsonb
       WHERE profile_id = $1 AND task_type = $2`,
      [idProfile, "export_user_data"],
    );

    // Support overrides the cooldown.
    await handler(
      {
        userData: {
          userId: "support-app-1",
          isM2MApplication: true,
          organizationId: undefined,
        },
        body: {
          type: "export_user_data",
          profileId: idProfile,
          requesterUserId: "support-agent-1",
        },
        server: stubServer,
      } as unknown as FastifyRequestTypebox<typeof CreateLifecycleTaskSchema>,
      {} as unknown as FastifyReplyTypebox<typeof CreateLifecycleTaskSchema>,
    );

    const { rows } = await pool.query(
      `SELECT * FROM data_lifecycle_tasks WHERE profile_id = $1 AND task_type = $2`,
      [idProfile, "export_user_data"],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      status: "pending",
      requester_application_id: "support-app-1",
      requester_user_id: "support-agent-1",
    });
    // The stale download link must not survive the reset.
    expect(rows[0].metadata.uploadId).toBeUndefined();
    expect(rows[0].metadata.expiresAt).toEqual(expect.any(String));
  });

  it("refuses an M2M reset while a previous export is still processing, even though allowOverride is true", async () => {
    const idProfile = randomUUID().substring(0, 12);
    const client = await pool.connect();

    try {
      await createProfile(client, {
        email: `${randomUUID().substring(0, 5)}@example.com`,
        id: idProfile,
        primaryUserId: idProfile,
        publicName: "A B",
      });

      await client.query(
        `
        INSERT INTO data_lifecycle_tasks
        (task_type, profile_id, scheduled_at, status, metadata, requester_user_id, requester_application_id)
        VALUES ('export_user_data', $1, now(), 'processing', '{"expiresAt":"2999-01-01T00:00:00.000Z"}'::jsonb, $2, NULL)
        `,
        [idProfile, idProfile],
      );
    } finally {
      client.release();
    }

    const handler = handleCreate(pool, getMockAuditLogger(idProfile));

    // Support tries to override while the worker is mid-export.
    await expect(
      handler(
        {
          userData: {
            userId: "support-app-1",
            isM2MApplication: true,
            organizationId: undefined,
          },
          body: {
            type: "export_user_data",
            profileId: idProfile,
            requesterUserId: "support-agent-1",
          },
          server: stubServer,
        } as unknown as FastifyRequestTypebox<typeof CreateLifecycleTaskSchema>,
        {} as unknown as FastifyReplyTypebox<typeof CreateLifecycleTaskSchema>,
      ),
    ).rejects.toThrow("task is already in progress");

    // The in-flight row must be untouched: still processing, still the
    // citizen as requester, no application recorded.
    const { rows } = await pool.query(
      `SELECT * FROM data_lifecycle_tasks WHERE profile_id = $1 AND task_type = $2`,
      [idProfile, "export_user_data"],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      status: "processing",
      requester_user_id: idProfile,
      requester_application_id: null,
    });
  });
});
