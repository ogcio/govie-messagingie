import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { updateMessageAction } from "../../../services/message-actions/message-action-service.js";
import { MessagingEventType } from "../../../services/messages/event-logger.js";
import type { PutMessageActionBody } from "../../../types/message-actions.js";
import { messagesReadCounter } from "../../../utils/metrics.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "../../build-testcontainer-pg.js";
import { getMockBaseLogger } from "../../test-server-builder.js";

vi.mock("../../../utils/authentication-factory.js", () => ({
  getPersonalProfileSdk: vi.fn().mockResolvedValue({
    getProfile: vi.fn().mockResolvedValue({
      data: {
        id: "actionUserId",
        linkedProfiles: [
          {
            id: "aUserId",
          },
        ],
      },
    }),
  }),
}));

vi.mock("../../../utils/metrics.js", () => ({
  messagesSentCounter: { add: vi.fn() },
  messagesReadCounter: { add: vi.fn() },
  messagesCreatedCounter: { add: vi.fn() },
  messagesQueueGauge: { record: vi.fn() },
  messagesScheduledCounter: { add: vi.fn() },
  messagesFailedCounter: { add: vi.fn() },
  messageDeliveryDurationHistogram: { record: vi.fn() },
  setupAsyncMetrics: vi.fn(),
}));

let pool: Pool;
const organizationId = "message-action-org";
const userId = "actionUserId";
beforeAll(() => {
  pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
});

afterAll(async () => {
  if (pool) {
    await pool.end();
  }
});

async function insertMockMessage({
  userId,
  isSeen,
  isDelivered,
}: {
  userId: string;
  isSeen: boolean;
  isDelivered: boolean;
}): Promise<{ id: string; user_id: string; organisation_id: string }> {
  const valueArray = [
    isDelivered,
    userId,
    "Test Subject",
    "Test Excerpt",
    "Test Plain Text",
    "Test Rich Text",
    "public",
    "en",
    "{email}",
    "Test Thread",
    organizationId,
    new Date().toISOString(),
    isSeen,
  ];

  const values = valueArray.map((_, i) => `$${i + 1}`).join(", ");

  const insertQueryResult = await pool.query<{
    id: string;
    user_id: string;
    organisation_id: string;
  }>(
    `
      insert into messages(
          is_delivered,
          user_id,
          subject,
          excerpt,
          plain_text,
          rich_text,
          security_level,
          lang,
          preferred_transports,
          thread_name,
          organisation_id,
          scheduled_at,
          is_seen
      ) values (${values})
      returning 
        id, user_id, organisation_id;
    `,
    valueArray,
  );

  return insertQueryResult.rows[0];
}

describe("Update Message Action works for delivered messages", () => {
  it("should update message read status successfully if delivered", async () => {
    const message = await insertMockMessage({
      userId: userId,
      isSeen: false,
      isDelivered: true,
    });
    const body: PutMessageActionBody = {
      messageId: message.id,
      isSeen: true,
    };

    await updateMessageAction({
      loggedInUser: {
        userId: message.user_id,
        accessToken: "accessToken",
      },
      body,
      pool,
      logger: getMockBaseLogger(),
    });

    const updatedMessage = await pool.query(
      "SELECT is_seen FROM messages WHERE id = $1",
      [message.id],
    );

    expect(updatedMessage.rows[0].is_seen).toBe(true);

    const unseenBody: PutMessageActionBody = {
      messageId: message.id,
      isSeen: false,
    };

    await updateMessageAction({
      loggedInUser: {
        userId: message.user_id,
        accessToken: "accessToken",
      },
      body: unseenBody,
      pool,
      logger: getMockBaseLogger(),
    });

    const unseenMessage = await pool.query(
      "SELECT is_seen FROM messages WHERE id = $1",
      [message.id],
    );

    expect(unseenMessage.rows[0].is_seen).toBe(false);
  });

  it("should update message read status successfully if delivered and user is not the recipient", async () => {
    const message = await insertMockMessage({
      userId: "aUserId",
      isSeen: false,
      isDelivered: true,
    });
    const body: PutMessageActionBody = {
      messageId: message.id,
      isSeen: true,
    };

    await updateMessageAction({
      loggedInUser: {
        userId,
        accessToken: "accessToken",
      },
      body,
      pool,
      logger: getMockBaseLogger(),
    });

    const updatedMessage = await pool.query(
      "SELECT is_seen FROM messages WHERE id = $1",
      [message.id],
    );

    expect(updatedMessage.rows[0].is_seen).toBe(true);
  });

  it("should throw an error if the user is not the recipient (with linked profiles)", async () => {
    const message = await insertMockMessage({
      userId: "noUserId",
      isSeen: false,
      isDelivered: true,
    });
    const body: PutMessageActionBody = {
      messageId: message.id,
      isSeen: true,
    };

    await expect(
      updateMessageAction({
        loggedInUser: {
          userId,
          accessToken: "accessToken",
        },
        body,
        pool,
        logger: getMockBaseLogger(),
      }),
    ).rejects.toThrow("message not found for user");
  });

  it("should throw not found error if message does not exist", async () => {
    const body: PutMessageActionBody = {
      messageId: randomUUID(),
      isSeen: true,
    };

    await expect(
      updateMessageAction({
        loggedInUser: {
          userId: "non-existent-user",
          accessToken: "accessToken",
        },
        body,
        pool,
        logger: getMockBaseLogger(),
      }),
    ).rejects.toThrow("message not found");
  });

  it("should log event when message is marked as seen", async () => {
    const message = await insertMockMessage({
      userId: userId,
      isSeen: false,
      isDelivered: true,
    });
    const body: PutMessageActionBody = {
      messageId: message.id,
      isSeen: true,
    };

    const logger = getMockBaseLogger();

    await updateMessageAction({
      loggedInUser: {
        userId: message.user_id,
        accessToken: "accessToken",
      },
      body,
      pool,
      logger,
    });

    const eventLog = await pool.query<{
      event_status: string;
      event_type: string;
    }>(
      `SELECT
	event_status,
	event_type FROM messaging_event_logs where message_id = $1`,
      [message.id],
    );

    expect(eventLog.rowCount).toBe(1);
    expect(eventLog.rows[0].event_status).toStrictEqual(
      MessagingEventType.citizenSeenMessage.status,
    );
    expect(eventLog.rows[0].event_type).toStrictEqual(
      MessagingEventType.citizenSeenMessage.key,
    );
  });

  it("should not log event when message is marked as unseen", async () => {
    const message = await insertMockMessage({
      userId: userId,
      isSeen: true,
      isDelivered: true,
    });
    const body: PutMessageActionBody = {
      messageId: message.id,
      isSeen: false,
    };

    await updateMessageAction({
      loggedInUser: {
        userId: message.user_id,
        accessToken: "accessToken",
      },
      body,
      pool,
      logger: getMockBaseLogger(),
    });

    const eventLog = await pool.query<{ id: string }>(
      "SELECT id FROM messaging_event_logs where message_id = $1",
      [message.id],
    );

    expect(eventLog.rowCount).toBe(0);
  });

  it("should not log event if input status is equal as current", async () => {
    const message = await insertMockMessage({
      userId: userId,
      isSeen: true,
      isDelivered: true,
    });
    const body: PutMessageActionBody = {
      messageId: message.id,
      isSeen: true,
    };

    await updateMessageAction({
      loggedInUser: {
        userId: message.user_id,
        accessToken: "accessToken",
      },
      body,
      pool,
      logger: getMockBaseLogger(),
    });

    const eventLog = await pool.query<{ id: string }>(
      "SELECT id FROM messaging_event_logs where message_id = $1",
      [message.id],
    );

    expect(eventLog.rowCount).toBe(0);
  });

  it("emits messages_read tagged with the message's organisation", async () => {
    const message = await insertMockMessage({
      userId: userId,
      isSeen: false,
      isDelivered: true,
    });
    const body: PutMessageActionBody = {
      messageId: message.id,
      isSeen: true,
    };

    await updateMessageAction({
      loggedInUser: {
        userId: message.user_id,
        accessToken: "accessToken",
      },
      body,
      pool,
      logger: getMockBaseLogger(),
    });

    expect(messagesReadCounter.add).toHaveBeenCalledWith(1, {
      organizationId,
    });
  });
});

describe("Update Message Action works for UNdelivered messages", () => {
  it("should update message read status", async () => {
    const message = await insertMockMessage({
      userId: userId,
      isSeen: false,
      isDelivered: false,
    });
    const body: PutMessageActionBody = {
      messageId: message.id,
      isSeen: true,
    };

    await updateMessageAction({
      loggedInUser: {
        userId: message.user_id,
        accessToken: "accessToken",
      },
      body,
      pool,
      logger: getMockBaseLogger(),
    });

    const updatedMessage = await pool.query(
      "SELECT is_seen FROM messages WHERE id = $1",
      [message.id],
    );

    expect(updatedMessage.rows[0].is_seen).toBe(true);

    const unseenBody: PutMessageActionBody = {
      messageId: message.id,
      isSeen: false,
    };

    await updateMessageAction({
      loggedInUser: {
        userId: message.user_id,
        accessToken: "accessToken",
      },
      body: unseenBody,
      pool,
      logger: getMockBaseLogger(),
    });

    const unseenMessage = await pool.query(
      "SELECT is_seen FROM messages WHERE id = $1",
      [message.id],
    );

    expect(unseenMessage.rows[0].is_seen).toBe(false);
  });

  it("should log event when message is marked as seen", async () => {
    const message = await insertMockMessage({
      userId: userId,
      isSeen: false,
      isDelivered: false,
    });
    const body: PutMessageActionBody = {
      messageId: message.id,
      isSeen: true,
    };

    const logger = getMockBaseLogger();

    await updateMessageAction({
      loggedInUser: {
        userId: message.user_id,
        accessToken: "accessToken",
      },
      body,
      pool,
      logger,
    });

    const eventLog = await pool.query<{
      event_status: string;
      event_type: string;
    }>(
      `SELECT
	event_status,
	event_type FROM messaging_event_logs where message_id = $1`,
      [message.id],
    );

    expect(eventLog.rowCount).toBe(1);
  });

  it("should not log event when message is marked as unseen", async () => {
    const message = await insertMockMessage({
      userId: userId,
      isSeen: false,
      isDelivered: false,
    });
    const body: PutMessageActionBody = {
      messageId: message.id,
      isSeen: false,
    };

    await updateMessageAction({
      loggedInUser: {
        userId: message.user_id,
        accessToken: "accessToken",
      },
      body,
      pool,
      logger: getMockBaseLogger(),
    });

    const eventLog = await pool.query<{ id: string }>(
      "SELECT id FROM messaging_event_logs where message_id = $1",
      [message.id],
    );

    expect(eventLog.rowCount).toBe(0);
  });
});
