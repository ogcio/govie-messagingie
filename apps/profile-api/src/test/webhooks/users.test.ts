import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildLogtoClient } from "~/clients/logto.js";
import type { EnvConfig } from "~/plugins/external/env.js";
import type { LogtoUserCreatedBody } from "~/schemas/webhooks/logto-user-created.js";
import { processUserWebhook } from "~/services/webhooks/users.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { mockLogger } from "~/test/fixtures/common.js";

describe("processUserWebhook", () => {
  const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    if (!pool.ended) {
      await pool.end();
    }
  });

  it("should process User.Created event", async () => {
    const webhookBody: LogtoUserCreatedBody = {
      event: "User.Created",
      data: {
        id: "user-123",
        primaryEmail: "test@example.com",
        username: null,
        identities: {},
        customData: {},
      },
    };

    const result = await processUserWebhook({
      body: webhookBody,
      pool,
      logger: mockLogger,
      config: {} as EnvConfig,
      getLogtoClient: () => buildLogtoClient({} as EnvConfig),
    });

    expect(result).toEqual({
      id: "user-123",
      status: "success",
    });
  });

  it("should process User.Data.Updated event", async () => {
    const webhookBody: LogtoUserCreatedBody = {
      event: "User.Data.Updated",
      data: {
        id: "user-123",
        primaryEmail: "test@example.com",
        username: null,
        identities: {},
        customData: {},
      },
    };

    const result = await processUserWebhook({
      body: webhookBody,
      pool,
      logger: mockLogger,
      config: {} as EnvConfig,
      getLogtoClient: () => buildLogtoClient({} as EnvConfig),
    });

    expect(result).toEqual({
      id: "user-123",
      status: "success",
    });
  });

  it("should throw error for unimplemented events", async () => {
    const webhookBody = {
      event: "User.Deleted",
      data: {
        id: "user-123",
      },
    };

    await expect(
      processUserWebhook({
        body: webhookBody as LogtoUserCreatedBody,
        pool,
        logger: mockLogger,
        config: {} as EnvConfig,
        getLogtoClient: () => buildLogtoClient({} as EnvConfig),
      }),
    ).rejects.toThrow("This event, User.Deleted, is not managed yet");
  });
});
