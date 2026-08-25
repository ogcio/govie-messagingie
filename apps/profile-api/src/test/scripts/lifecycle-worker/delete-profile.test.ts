import { randomUUID } from "node:crypto";
import type { BuildingBlocksSDK } from "@ogcio/building-blocks-sdk/dist/types/index.js";
import type { PoolClient } from "pg";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { DPProxyClient } from "~/clients/dp-proxy.js";
import type { LogtoClient } from "~/clients/logto.js";
import {
  type LifecycleTask,
  LifecycleTaskStatuses,
  LifecycleTaskTypes,
} from "~/schemas/data-lifecycle-tasks/index.js";
import { ProfileStatuses } from "~/schemas/profiles/model.js";
import {
  DeleteProfileSteps,
  executeDeleteProfileSteps,
} from "~/scripts/lifecycle-worker/steps/delete-profile.js";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import { createProfileDataForProfileDetail } from "~/services/profiles/sql/create-profile-data-for-profile-details.js";
import { createProfileDetails } from "~/services/profiles/sql/create-profile-details.js";
import type { AuditLogInput } from "~/types/audit-logger.js";
import { AuditLogger } from "~/utils/audit-logger.js";
import { buildMockLogger } from "../../build-mock-logger.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "../../build-testcontainer-pg.js";

describe("executeDeleteProfileSteps", () => {
  const pool = getPoolFromConnectionString(
    process.env[DATABASE_TEST_URL_KEY] as string,
  );
  const { logger } = buildMockLogger({});

  const dpProxyClientMock = {
    anonymizeUser: vi.fn(),
  } as unknown as DPProxyClient;

  const logtoClientMock = {
    deleteUser: vi.fn(),
  } as unknown as LogtoClient;

  const auditLogEntries: AuditLogInput[] = [];
  const mockAuditCollector = {
    sendLogs: vi.fn(async (logs: AuditLogInput[]) => {
      auditLogEntries.push(...logs);
      const toReturn = logs.map((_log) => ({ id: randomUUID() }));
      return { data: toReturn };
    }),
  };
  const auditLogger = new AuditLogger(
    mockAuditCollector as unknown as BuildingBlocksSDK["auditCollector"],
    {
      user_id: "test-user",
      client_timestamp: new Date().toISOString(),
      metadata: { default: "metadata" },
    },
  ) as AuditLogger<"user_id" | "client_timestamp" | "metadata">;

  beforeEach(() => {
    auditLogEntries.length = 0;
  });

  const createTestProfile = async (
    client: PoolClient,
    options: {
      profileId?: string;
      email?: string;
      publicName?: string;
      addProfileData?: boolean;
      orgId?: string | null;
    } = {},
  ) => {
    const profileId = options.profileId || randomUUID().substring(0, 12);
    const email = options.email || `${profileId}@example.com`;
    const publicName = options.publicName || `User ${profileId}`;

    await createProfile(client, {
      id: profileId,
      email,
      publicName,
      primaryUserId: profileId,
    });

    const orgId =
      options.orgId === null ? undefined : (options.orgId ?? undefined);

    const profileDetailId = await createProfileDetails(
      client,
      profileId,
      orgId,
    );

    if (options.addProfileData) {
      await createProfileDataForProfileDetail(client, profileDetailId, {
        someKey: "someValue",
        email: email,
        firstName: "First",
        lastName: "Last",
      });
    }

    return { profileId, email, publicName, profileDetailId };
  };

  it("should successfully execute all steps for a valid profile", async () => {
    const client = await pool.connect();
    try {
      // 1. Setup
      const { profileId, email, publicName } = await createTestProfile(client, {
        addProfileData: true,
        orgId: null, // User provided data
      });

      const task: LifecycleTask = {
        id: randomUUID(),
        task_type: LifecycleTaskTypes.DeleteProfile,
        profile_id: profileId,
        status: LifecycleTaskStatuses.Pending,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        retry_count: 0,
        metadata: {},
        scheduled_at: new Date().toISOString(),
        requester_application_id: null,
        requester_user_id: null,
      };

      // 2. Execute
      const result = await executeDeleteProfileSteps({
        pool,
        task,
        logger,
        dpProxyClient: dpProxyClientMock,
        logtoClient: logtoClientMock,
        auditLogger,
      });

      // 3. Assert Result
      expect(result).toEqual({ success: true });

      // 4. Assert Calls
      expect(dpProxyClientMock.anonymizeUser).toHaveBeenCalledWith(
        { event: "anonymize_user", profileIds: [profileId] },
        logger,
      );
      expect(logtoClientMock.deleteUser).toHaveBeenCalledWith(profileId);

      // 5. Assert DB State
      const profileResult = await client.query(
        "SELECT * FROM profiles WHERE id = $1",
        [profileId],
      );
      const profile = profileResult.rows[0];

      expect(profile.status).toBe(ProfileStatuses.Deleted);
      expect(profile.public_name).not.toBe(publicName);
      expect(profile.email).not.toBe(email);
      expect(profile.updated_at).toBeDefined();

      const profileDataResult = await client.query(
        `SELECT pd.value FROM profile_data pd
         JOIN profile_details pdet ON pd.profile_details_id = pdet.id
         WHERE pdet.profile_id = $1`,
        [profileId],
      );
      const dataValue = profileDataResult.rows[0].value;
      expect(dataValue).not.toBe("someValue");

      // 1. Start deletion
      // 2. Start DP Proxy Anonymization
      // 3. Start Logto Deletion
      // 4. Start Anonymize Profiles
      // 5. Start Anonymize Profile Data
      // 6. Completed
      expect(auditLogEntries.length).toBe(6);
      // All the entries except the first one (that is the one where we get id from)
      // should have a parent_log_entry_id, and they should all share the same parent_log_entry_id
      const parentLogEntries = auditLogEntries.filter(
        (log) => log.parent_log_entry_id !== undefined,
      );
      expect(parentLogEntries.length).toBe(5);
      const logEntryValues = new Set(
        parentLogEntries.map((log) => log.parent_log_entry_id),
      );

      expect(logEntryValues.size).toBe(1);

      for (const log of auditLogEntries) {
        expect(log.application_id).toBe("profile-api");
        expect(log.user_id).toBe("test-user");
        expect(log.metadata).toEqual(
          expect.objectContaining({ default: "metadata" }),
        );
        expect(log.client_timestamp).toBeDefined();
        expect(log.action_type).toBe("delete");
        expect(log.resource_type).toBe("profile");
      }
    } finally {
      client.release();
    }
  });

  it("should resume from last successful step", async () => {
    const client = await pool.connect();
    try {
      const { profileId } = await createTestProfile(client);

      const task: LifecycleTask = {
        id: randomUUID(),
        task_type: LifecycleTaskTypes.DeleteProfile,
        profile_id: profileId,
        status: LifecycleTaskStatuses.Pending,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        retry_count: 1,
        metadata: {
          last_step: DeleteProfileSteps.DELETE_LOGTO_USER,
          logto_deleted_ids: [profileId],
        },
        scheduled_at: new Date().toISOString(),
        requester_application_id: null,
        requester_user_id: null,
      };

      vi.clearAllMocks();

      await executeDeleteProfileSteps({
        pool,
        task,
        logger,
        dpProxyClient: dpProxyClientMock,
        logtoClient: logtoClientMock,
        auditLogger,
      });

      // Should skip DP Proxy and Logto delete because they are done/dependencies met
      expect(dpProxyClientMock.anonymizeUser).not.toHaveBeenCalled();
      expect(logtoClientMock.deleteUser).not.toHaveBeenCalled();

      // Should still anonymize DB
      const profileResult = await client.query(
        "SELECT status FROM profiles WHERE id = $1",
        [profileId],
      );
      expect(profileResult.rows[0].status).toBe(ProfileStatuses.Deleted);
    } finally {
      client.release();
    }
  });

  it("should handle fatal failure when profile not found", async () => {
    const client = await pool.connect();
    try {
      const task: LifecycleTask = {
        id: randomUUID(),
        task_type: LifecycleTaskTypes.DeleteProfile,
        profile_id: "non-existent-id",
        status: LifecycleTaskStatuses.Pending,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        retry_count: 0,
        metadata: {},
        scheduled_at: new Date().toISOString(),
        requester_application_id: null,
        requester_user_id: null,
      };

      const result = await executeDeleteProfileSteps({
        pool,
        task,
        logger,
        dpProxyClient: dpProxyClientMock,
        logtoClient: logtoClientMock,
        auditLogger,
      });

      expect(result).toEqual({
        success: false,
        error: new Error("Profile with id non-existent-id not found"),
      });

      expect(auditLogEntries.length).toBe(2);
      expect(auditLogEntries[1].successful).toBe(false);
      expect(auditLogEntries[1].failure_reason).toBe("Profile not found");
    } finally {
      client.release();
    }
  });

  it("should process linked profiles", async () => {
    const client = await pool.connect();
    try {
      const primaryId = randomUUID().substring(0, 12);
      // Create primary
      await createProfile(client, {
        id: primaryId,
        email: `p-${primaryId}@ex.com`,
        publicName: "Primary",
        primaryUserId: primaryId,
      });

      // Create linked
      const linkedId = randomUUID().substring(0, 12);
      await createProfile(client, {
        id: linkedId,
        email: `l-${linkedId}@ex.com`,
        publicName: "Linked",
        primaryUserId: primaryId,
      });

      // Setup data
      await createProfileDetails(client, primaryId, undefined);
      await createProfileDetails(client, linkedId, undefined);

      const task: LifecycleTask = {
        id: randomUUID(),
        task_type: LifecycleTaskTypes.DeleteProfile,
        profile_id: primaryId,
        status: LifecycleTaskStatuses.Pending,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        retry_count: 0,
        metadata: {},
        scheduled_at: new Date().toISOString(),
        requester_application_id: null,
        requester_user_id: null,
      };

      vi.clearAllMocks();

      await executeDeleteProfileSteps({
        pool,
        task,
        logger,
        dpProxyClient: dpProxyClientMock,
        logtoClient: logtoClientMock,
        auditLogger,
      });

      // Check DP Proxy called with both
      const callArgs = (dpProxyClientMock.anonymizeUser as Mock).mock
        .calls[0][0];
      expect(callArgs.profileIds).toContain(primaryId);
      expect(callArgs.profileIds).toContain(linkedId);
      expect(callArgs.profileIds).toHaveLength(2);

      // Check Logto deletion for both
      expect(logtoClientMock.deleteUser).toHaveBeenCalledTimes(2);
      expect(logtoClientMock.deleteUser).toHaveBeenCalledWith(primaryId);
      expect(logtoClientMock.deleteUser).toHaveBeenCalledWith(linkedId);

      // Check DB updates
      const res = await client.query(
        "SELECT id, status FROM profiles WHERE id = ANY($1)",
        [[primaryId, linkedId]],
      );
      expect(res.rows).toHaveLength(2);
      for (const r of res.rows) {
        expect(r.status).toBe(ProfileStatuses.Deleted);
      }
    } finally {
      client.release();
    }
  });

  it("should rollback transaction on DB error during anonymization", async () => {
    // Use separate clients: one for test setup/verification, one for the function under test
    const setupClient = await pool.connect();
    let functionClient: PoolClient | null = null;

    try {
      const { profileId } = await createTestProfile(setupClient);

      const task: LifecycleTask = {
        id: randomUUID(),
        task_type: LifecycleTaskTypes.DeleteProfile,
        profile_id: profileId,
        status: LifecycleTaskStatuses.Pending,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        retry_count: 0,
        metadata: {},
        scheduled_at: new Date().toISOString(),
        requester_application_id: null,
        requester_user_id: null,
      };

      // Create a proxy pool that returns a client with a failing query
      const proxyPool = new Proxy(pool, {
        get(target, prop) {
          if (prop === "connect") {
            return async () => {
              // Acquire a fresh client for the function
              functionClient = await target.connect();
              const originalQuery = functionClient.query.bind(functionClient);

              const failingQuery = vi.fn((...args: unknown[]) => {
                if (
                  typeof args[0] === "string" &&
                  args[0].includes("UPDATE profiles")
                ) {
                  throw new Error("Simulated DB Error");
                }
                // biome-ignore lint/suspicious/noExplicitAny: Stubbing overloaded method
                return originalQuery(...(args as [any, any]));
              });

              return new Proxy(functionClient, {
                get(t, p) {
                  if (p === "query") return failingQuery;
                  return Reflect.get(t, p);
                },
              });
            };
          }
          if (prop === "query") {
            // For pool.query() calls, use a fresh query that can also fail
            const originalPoolQuery = target.query.bind(target);
            return (...args: unknown[]) => {
              if (
                typeof args[0] === "string" &&
                args[0].includes("UPDATE profiles")
              ) {
                throw new Error("Simulated DB Error");
              }
              // biome-ignore lint/suspicious/noExplicitAny: Stubbing overloaded method
              return originalPoolQuery(...(args as [any, any]));
            };
          }
          return Reflect.get(target, prop);
        },
      });

      await expect(
        executeDeleteProfileSteps({
          pool: proxyPool,
          task,
          logger,
          dpProxyClient: dpProxyClientMock,
          logtoClient: logtoClientMock,
          auditLogger,
        }),
      ).rejects.toThrow("Simulated DB Error");

      // Verify transaction rolled back using the setup client
      const profileResult = await setupClient.query(
        "SELECT status FROM profiles WHERE id = $1",
        [profileId],
      );
      expect(profileResult.rows[0].status).not.toBe(ProfileStatuses.Deleted);

      const lastAuditLog = auditLogEntries[auditLogEntries.length - 1];
      expect(lastAuditLog).toBeDefined();
      expect(lastAuditLog.successful).toBe(false);
      expect(lastAuditLog.failure_reason).toBe("Simulated DB Error");
    } finally {
      try {
        setupClient.release();
      } catch {}
    }
  });
});
