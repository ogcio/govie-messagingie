import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  getEventsForMessageId,
  getMessageEvent,
  listMessageEvents,
} from "../../../services/message-events/message-event-service.js";
import {
  MessagingEventLogger,
  MessagingEventType,
} from "../../../services/messages/event-logger.js";
import { getCurrentUTCDate } from "../../../utils/date-times.js";
import { utils } from "../../../utils/utils.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "../../build-testcontainer-pg.js";
import { getMockBaseLogger } from "../../test-server-builder.js";

let pool: Pool;
let messagingEventLogger: MessagingEventLogger;
const organizationId = "message-event-org";
const insertedMessageIds: Set<string> = new Set();

beforeAll(() => {
  pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
  messagingEventLogger = new MessagingEventLogger(pool, getMockBaseLogger());
});

afterAll(async () => {
  if (pool) {
    await pool.end();
  }
});

afterEach(async () => {
  afterEach(async () => {
    for (const messageId of insertedMessageIds) {
      await pool.query(
        "DELETE FROM message_event_summary where message_id = $1;",
        [messageId],
      );
      await pool.query(
        "DELETE FROM messaging_event_logs where message_id = $1;",
        [messageId],
      );
      await pool.query("DELETE FROM messages where id = $1;", [messageId]);
    }
    insertedMessageIds.clear();
  });
});

async function insertMockMessage(
  subject = "Sub",
  scheduledDate?: string,
  isSeen?: boolean,
  organisationId?: string,
): Promise<{ id: string; user_id: string; organisation_id: string }> {
  const valueArray = [
    false,
    randomUUID().substring(0, 11),
    subject,
    "Exc",
    "plain",
    "rich",
    "public",
    "en",
    utils.postgresArrayify(["lifeEvent"]),
    "threadName",
    organisationId ?? organizationId,
    scheduledDate ?? getCurrentUTCDate(),
    Boolean(isSeen),
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

  insertedMessageIds.add(insertQueryResult.rows[0].id);

  return insertQueryResult.rows[0];
}

describe("Message Event Service - getEvent", () => {
  it("should process messages successfully", async () => {
    const message = await insertMockMessage();
    messagingEventLogger.log(MessagingEventType.createRawMessage, {
      messageId: message.id,
      organisationName: message.organisation_id,
      receiverFullName: message.user_id,
    });
    messagingEventLogger.log(MessagingEventType.deliverMessage, {
      messageId: message.id,
    });
    await messagingEventLogger.commit();
    const listed = await listMessageEvents({
      pagination: { offset: "0", limit: "100" },
      pool,
      organizationId: message.organisation_id,
    });

    expect(listed.totalCount).toBe(1);

    const single = await getMessageEvent({
      eventId: listed.data[0].id,
      organizationId: message.organisation_id,
      pool,
    });

    expect(single.length).toBe(2);

    expect(single[0].messageId).toBe(message.id);
    expect(single[1].messageId).toBe(message.id);
    expect(single[0].eventType).toBe(MessagingEventType.deliverMessage.key);
    expect(single[1].eventType).toBe(MessagingEventType.createRawMessage.key);
  });

  it("should handle errors if no event exists", async () => {
    await expect(
      getMessageEvent({
        eventId: randomUUID(),
        organizationId: randomUUID(),
        pool,
      }),
    ).rejects.toThrow("No message event found for the organization");
  });

  it("should prevent accessing events from other organizations", async () => {
    // Create event in correct organization
    const correctOrgMessage = await insertMockMessage();
    messagingEventLogger.log(MessagingEventType.createRawMessage, {
      messageId: correctOrgMessage.id,
      organisationName: correctOrgMessage.organisation_id,
      receiverFullName: correctOrgMessage.user_id,
    });
    await messagingEventLogger.commit();

    // Create event in different organization
    const maliciousOrgId = "malicious-org";
    const maliciousMessage = await insertMockMessage();
    await pool.query("UPDATE messages SET organisation_id = $1 WHERE id = $2", [
      maliciousOrgId,
      maliciousMessage.id,
    ]);
    messagingEventLogger.log(MessagingEventType.createRawMessage, {
      messageId: maliciousMessage.id,
      organisationName: maliciousOrgId,
      receiverFullName: maliciousMessage.user_id,
    });
    await messagingEventLogger.commit();

    // Try to access malicious message with correct org ID
    await expect(
      getMessageEvent({
        eventId: maliciousMessage.id,
        organizationId: correctOrgMessage.organisation_id, // Correct org ID
        pool,
      }),
    ).rejects.toThrow("No message event found for the organization");
  });
});

describe("Message Event Service - listEvents", () => {
  it("should return empty list if no events", async () => {
    const orgId = randomUUID().substring(1, 8);
    const listed = await listMessageEvents({
      pagination: { offset: "0", limit: "100" },
      pool,
      organizationId: orgId,
    });

    expect(listed.totalCount).toBe(0);
    expect(listed.data.length).toBe(0);
  });

  it("should paginate events correctly", async () => {
    const createdMockMessages = [];
    const orgId = randomUUID().substring(1, 8);
    for (let i = 0; i < 5; i++) {
      const message = await insertMockMessage(
        `sub-${i}`,
        undefined,
        undefined,
        orgId,
      );
      messagingEventLogger.log(MessagingEventType.createRawMessage, {
        messageId: message.id,
        organisationName: message.organisation_id,
        receiverFullName: message.user_id,
      });
      createdMockMessages.push(message);
    }

    await messagingEventLogger.commit();
    const listed = await listMessageEvents({
      pagination: { offset: "0", limit: "100" },
      pool,
      organizationId: orgId,
    });

    expect(listed.totalCount).toBe(createdMockMessages.length);
    expect(listed.data.map((d) => d.messageId).sort()).toStrictEqual(
      createdMockMessages.map((c) => c.id).sort(),
    );

    // first page
    const firstPage = await listMessageEvents({
      pagination: { offset: "0", limit: "2" },
      pool,
      organizationId: orgId,
    });
    expect(firstPage.totalCount).toBe(createdMockMessages.length);
    expect(firstPage.data.length).toBe(2);
    expect(firstPage.data[0].id).toBe(listed.data[0].id);
    expect(firstPage.data[1].id).toBe(listed.data[1].id);

    // second page
    const secondPage = await listMessageEvents({
      pagination: { offset: "2", limit: "2" },
      pool,
      organizationId: orgId,
    });

    expect(secondPage.totalCount).toBe(createdMockMessages.length);
    expect(secondPage.data.length).toBe(2);
    expect(secondPage.data[0].id).toBe(listed.data[2].id);
    expect(secondPage.data[1].id).toBe(listed.data[3].id);

    // third page, must return only one item because total 5
    const thirdPage = await listMessageEvents({
      pagination: { offset: "4", limit: "2" },
      pool,
      organizationId: orgId,
    });

    expect(thirdPage.totalCount).toBe(createdMockMessages.length);
    expect(thirdPage.data.length).toBe(1);
    expect(thirdPage.data[0].id).toBe(listed.data[4].id);

    // overflow
    const overflow = await listMessageEvents({
      pagination: { offset: "6", limit: "2" },
      pool,
      organizationId: orgId,
    });

    expect(overflow.totalCount).toBe(createdMockMessages.length);
    expect(overflow.data.length).toBe(0);
  });

  it("should find equal subject", async () => {
    const createdMockMessages = [];
    for (let i = 0; i < 5; i++) {
      const message = await insertMockMessage(`sub-bis-${i}`);
      messagingEventLogger.log(MessagingEventType.createRawMessage, {
        messageId: message.id,
        organisationName: message.organisation_id,
        receiverFullName: message.user_id,
      });
      createdMockMessages.push(message);
    }

    await messagingEventLogger.commit();
    const listed = await listMessageEvents({
      pagination: { offset: "0", limit: "100" },
      pool,
      organizationId: organizationId,
      search: "sub-bis-0",
    });

    expect(listed.totalCount).toBe(1);
    expect(listed.data[0].messageId).toBe(createdMockMessages[0].id);
  });

  it("should find like subject", async () => {
    const createdMockMessages = [];
    for (let i = 0; i < 5; i++) {
      const message = await insertMockMessage(`sub-another-${i}`);
      messagingEventLogger.log(MessagingEventType.createRawMessage, {
        messageId: message.id,
        organisationName: message.organisation_id,
        receiverFullName: message.user_id,
      });
      createdMockMessages.push(message);
    }

    await messagingEventLogger.commit();
    const listed = await listMessageEvents({
      pagination: { offset: "0", limit: "100" },
      pool,
      organizationId: organizationId,
      search: "-another-",
    });

    expect(listed.totalCount).toBe(5);
  });

  it("should find equal recipient", async () => {
    const createdMockMessages = [];
    for (let i = 0; i < 5; i++) {
      const message = await insertMockMessage(`sub-eq-rec-${i}`);
      messagingEventLogger.log(MessagingEventType.createRawMessage, {
        messageId: message.id,
        organisationName: message.organisation_id,
        receiverFullName: message.user_id,
      });
      createdMockMessages.push(message);
    }

    await messagingEventLogger.commit();
    const listed = await listMessageEvents({
      pagination: { offset: "0", limit: "100" },
      pool,
      organizationId: organizationId,
      search: createdMockMessages[0].user_id,
    });

    expect(listed.totalCount).toBe(1);
    expect(listed.data[0].messageId).toBe(createdMockMessages[0].id);
  });

  it("should find like recipients", async () => {
    const createdMockMessages = [];
    for (let i = 0; i < 5; i++) {
      const message = await insertMockMessage(`sub-like-rec-${i}`);
      messagingEventLogger.log(MessagingEventType.createRawMessage, {
        messageId: message.id,
        organisationName: message.organisation_id,
        receiverFullName: `Something ${i} - Charlie Chaplin`,
      });
      createdMockMessages.push(message);
    }

    await messagingEventLogger.commit();
    const listed = await listMessageEvents({
      pagination: { offset: "0", limit: "100" },
      pool,
      organizationId: organizationId,
      search: "0 - Charlie",
    });

    expect(listed.totalCount).toBe(1);
  });

  it("should find like PPSN", async () => {
    const createdMockMessages = [];
    const ppsn = randomUUID().substring(0, 8);
    for (let i = 0; i < 5; i++) {
      const message = await insertMockMessage(`sub-like-rec-${i}`);
      messagingEventLogger.log(MessagingEventType.createRawMessage, {
        messageId: message.id,
        organisationName: message.organisation_id,
        receiverFullName: `Something ${i} - John Doe`,
        receiverPPSN: `${ppsn}${i}`,
      });
      createdMockMessages.push(message);
    }

    await messagingEventLogger.commit();
    const listed = await listMessageEvents({
      pagination: { offset: "0", limit: "100" },
      pool,
      organizationId: organizationId,
      search: ppsn,
    });

    expect(listed.totalCount).toBe(5);
    const messageIds = createdMockMessages.map((m) => m.id);
    expect(messageIds.sort()).toStrictEqual(
      listed.data.map((d) => d.messageId).sort(),
    );
  });

  it("should find equal PPSN", async () => {
    const createdMockMessages = [];
    const ppsn = randomUUID().substring(0, 8);
    for (let i = 0; i < 5; i++) {
      const message = await insertMockMessage(`sub-like-rec-${i}`);
      messagingEventLogger.log(MessagingEventType.createRawMessage, {
        messageId: message.id,
        organisationName: message.organisation_id,
        receiverFullName: `Something ${i} - Equal PPSN`,
        receiverPPSN: `${ppsn}${i}`,
      });
      createdMockMessages.push(message);
    }

    await messagingEventLogger.commit();
    const listed = await listMessageEvents({
      pagination: { offset: "0", limit: "100" },
      pool,
      organizationId: organizationId,
      search: `${ppsn}2`,
    });

    expect(listed.totalCount).toBe(1);
    expect(listed.data.length).toBe(1);
  });

  it("should find by recipient id", async () => {
    const createdMockMessages = [];
    for (let i = 0; i < 3; i++) {
      const message = await insertMockMessage(`sub-like-rec-${i}`);
      messagingEventLogger.log(MessagingEventType.createRawMessage, {
        messageId: message.id,
        organisationName: message.organisation_id,
        receiverFullName: `Something ${i} - John Doe`,
        receiverUserId: message.user_id,
      });
      createdMockMessages.push(message);
    }

    await messagingEventLogger.commit();
    const listed = await listMessageEvents({
      pagination: { offset: "0", limit: "100" },
      pool,
      organizationId: organizationId,
      recipientId: createdMockMessages[0].user_id,
    });

    expect(listed.totalCount).toBe(1);

    expect(listed.data.length).toBe(1);
    expect(listed.data[0].messageId).toBe(createdMockMessages[0].id);
  });

  it("should return last event status for each message with aggregated data", async () => {
    const orgId = randomUUID().substring(1, 8);
    const message = await insertMockMessage(
      "sub-last",
      undefined,
      undefined,
      orgId,
    );
    messagingEventLogger.log(MessagingEventType.createRawMessage, {
      messageId: message.id,
      organisationName: message.organisation_id,
      receiverFullName: message.user_id,
    });
    messagingEventLogger.log(MessagingEventType.deliverMessage, {
      messageId: message.id,
    });

    await messagingEventLogger.commit();
    const listed = await listMessageEvents({
      pagination: { offset: "0", limit: "100" },
      pool,
      organizationId: orgId,
    });

    expect(listed.totalCount).toBe(1);
    expect(listed.data[0].receiverFullName).toBe(message.user_id);
    expect(listed.data[0].eventStatus).toBe(
      MessagingEventType.deliverMessage.status,
    );
    expect(listed.data[0].eventType).toBe(
      MessagingEventType.deliverMessage.key,
    );
  });

  it("should order events by most recent activity, not by scheduled date", async () => {
    const orgId = randomUUID().substring(1, 8);
    // Message A has the latest scheduled_at but no activity after scheduling
    const messageA = await insertMockMessage(
      "order-stale-scheduled",
      new Date().toISOString(),
      undefined,
      orgId,
    );
    messagingEventLogger.log(MessagingEventType.scheduleMessage, {
      messageId: messageA.id,
    });

    // Message B was scheduled earlier but has more recent activity
    const messageB = await insertMockMessage(
      "order-recent-activity",
      new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      undefined,
      orgId,
    );
    messagingEventLogger.log(MessagingEventType.createRawMessage, {
      messageId: messageB.id,
      organisationName: messageB.organisation_id,
      receiverFullName: messageB.user_id,
    });
    messagingEventLogger.log(MessagingEventType.deliverMessage, {
      messageId: messageB.id,
    });

    await messagingEventLogger.commit();

    const listed = await listMessageEvents({
      pagination: { offset: "0", limit: "100" },
      pool,
      organizationId: orgId,
    });

    expect(listed.totalCount).toBe(2);
    expect(listed.data.map((d) => d.messageId)).toStrictEqual([
      messageB.id,
      messageA.id,
    ]);
  });

  it("should filter by date range correctly", async () => {
    const oldDate = new Date();
    oldDate.setFullYear(new Date().getFullYear() - 2);
    const orgId = randomUUID().substring(1, 8);
    const oldMessage = await insertMockMessage(
      "old message",
      new Date(oldDate.toUTCString()).toISOString(),
      undefined,
      orgId,
    );

    messagingEventLogger.log(MessagingEventType.createRawMessage, {
      messageId: oldMessage.id,
      organisationName: oldMessage.organisation_id,
      receiverFullName: oldMessage.user_id,
    });

    const newMessage = await insertMockMessage(
      "new message",
      undefined,
      undefined,
      orgId,
    );

    messagingEventLogger.log(MessagingEventType.createRawMessage, {
      messageId: newMessage.id,
      organisationName: newMessage.organisation_id,
      receiverFullName: newMessage.user_id,
    });

    await messagingEventLogger.commit();

    // Test default date range (last 365 days)
    const defaultList = await listMessageEvents({
      pagination: { offset: "0", limit: "100" },
      pool,
      organizationId: orgId,
    });

    expect(defaultList.totalCount).toBe(1);
    expect(defaultList.data[0].messageId).toBe(newMessage.id);

    // Test custom date range
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(new Date().getFullYear() - 3);
    const customList = await listMessageEvents({
      pagination: { offset: "0", limit: "100" },
      pool,
      organizationId: orgId,
      dateFrom: new Date(threeYearsAgo).toISOString().split("T")[0], // Simplified date format
      dateTo: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0], // Simplified date format
    });

    expect(customList.totalCount).toBe(1);
    expect(customList.data[0].messageId).toBe(oldMessage.id);
  });

  it("should return empty when offset exceeds total events", async () => {
    const orgId = randomUUID().substring(0, 8);
    // Create 3 messages with 2 events each (6 total events)
    for (let i = 0; i < 3; i++) {
      const message = await insertMockMessage(
        `offset-test-${i}`,
        undefined,
        undefined,
        orgId,
      );
      messagingEventLogger.log(MessagingEventType.createRawMessage, {
        messageId: message.id,
        organisationName: message.organisation_id,
        receiverFullName: message.user_id,
      });
      messagingEventLogger.log(MessagingEventType.deliverMessage, {
        messageId: message.id,
      });
    }
    await messagingEventLogger.commit();

    const result = await listMessageEvents({
      pagination: { offset: "6", limit: "10" },
      pool,
      organizationId: orgId,
    });

    expect(result.totalCount).toBe(3);
    expect(result.data.length).toBe(0);
  });

  it("should handle limit=0 by returning empty array", async () => {
    const orgId = randomUUID().substring(1, 8);
    const message = await insertMockMessage(
      "limit-zero-test",
      undefined,
      undefined,
      orgId,
    );
    messagingEventLogger.log(MessagingEventType.createRawMessage, {
      messageId: message.id,
      organisationName: message.organisation_id,
      receiverFullName: message.user_id,
    });
    await messagingEventLogger.commit();

    const result = await listMessageEvents({
      pagination: { offset: "0", limit: "0" },
      pool,
      organizationId: orgId,
    });

    expect(result.totalCount).toBe(1);
    expect(result.data.length).toBe(0);
  });

  it("should reject negative offset values with proper error", async () => {
    const orgId = randomUUID().substring(1, 5);
    const message = await insertMockMessage(
      "negative-test",
      undefined,
      undefined,
      orgId,
    );
    messagingEventLogger.log(MessagingEventType.createRawMessage, {
      messageId: message.id,
      organisationName: message.organisation_id,
      receiverFullName: message.user_id,
    });
    await messagingEventLogger.commit();

    await expect(
      listMessageEvents({
        pagination: { offset: "-5", limit: "10" },
        pool,
        organizationId: orgId,
      }),
    ).rejects.toThrow("OFFSET must not be negative");
  });

  it("should reject negative limit values with proper error", async () => {
    const orgId = randomUUID().substring(1, 5);
    const message = await insertMockMessage(
      "negative-test",
      undefined,
      undefined,
      orgId,
    );
    messagingEventLogger.log(MessagingEventType.createRawMessage, {
      messageId: message.id,
      organisationName: message.organisation_id,
      receiverFullName: message.user_id,
    });
    await messagingEventLogger.commit();

    await expect(
      listMessageEvents({
        pagination: { offset: "0", limit: "-10" },
        pool,
        organizationId: orgId,
      }),
    ).rejects.toThrow("LIMIT must not be negative");
  });

  it("should handle exact page size matches", async () => {
    const orgId = randomUUID().substring(1, 6);
    for (let i = 0; i < 10; i++) {
      const message = await insertMockMessage(
        `exact-page-${i}`,
        undefined,
        undefined,
        orgId,
      );
      messagingEventLogger.log(MessagingEventType.createRawMessage, {
        messageId: message.id,
        organisationName: message.organisation_id,
        receiverFullName: message.user_id,
      });
      messagingEventLogger.log(MessagingEventType.deliverMessage, {
        messageId: message.id,
      });
    }
    await messagingEventLogger.commit();

    const firstPage = await listMessageEvents({
      pagination: { offset: "0", limit: "10" },
      pool,
      organizationId: orgId,
    });
    expect(firstPage.data.length).toBe(10);
    expect(firstPage.totalCount).toBe(10);

    const secondPage = await listMessageEvents({
      pagination: { offset: "10", limit: "10" },
      pool,
      organizationId: orgId,
    });
    expect(secondPage.data.length).toBe(0);
    expect(secondPage.totalCount).toBe(10);
  });

  it("should handle very large limit values", async () => {
    const orgId = randomUUID().substring(1, 3);
    for (let i = 0; i < 4; i++) {
      const message = await insertMockMessage(
        `large-limit-${i}`,
        undefined,
        undefined,
        orgId,
      );
      messagingEventLogger.log(MessagingEventType.createRawMessage, {
        messageId: message.id,
        organisationName: message.organisation_id,
        receiverFullName: message.user_id,
      });
      messagingEventLogger.log(MessagingEventType.deliverMessage, {
        messageId: message.id,
      });
    }
    await messagingEventLogger.commit();

    const result = await listMessageEvents({
      pagination: { offset: "0", limit: "1000" },
      pool,
      organizationId: orgId,
    });
    expect(result.data.length).toBe(4);
    expect(result.totalCount).toBe(4);
  });

  it("should find on status delivered", async () => {
    const orgId = randomUUID().substring(1, 8);
    const message1 = await insertMockMessage(
      "subject 1",
      undefined,
      undefined,
      orgId,
    );
    const message2 = await insertMockMessage(
      "subject 2",
      undefined,
      undefined,
      orgId,
    );

    messagingEventLogger.log(MessagingEventType.deliverMessage, {
      messageId: message1.id,
      organisationName: message1.organisation_id,
    });

    messagingEventLogger.log(MessagingEventType.emailError, {
      messageId: message1.id,
      organisationName: message1.organisation_id,
    });

    messagingEventLogger.log(MessagingEventType.createRawMessage, {
      messageId: message2.id,
      organisationName: message2.organisation_id,
    });

    messagingEventLogger.log(MessagingEventType.scheduleMessage, {
      messageId: message2.id,
      organisationName: message2.organisation_id,
    });

    messagingEventLogger.log(MessagingEventType.deliverMessage, {
      messageId: message2.id,
      organisationName: message2.organisation_id,
    });

    await messagingEventLogger.commit();

    const events = await listMessageEvents({
      pagination: { offset: "0", limit: "100" },
      pool,
      organizationId: orgId,
      status: "delivered",
    });

    expect(events.totalCount).toEqual(1);
    expect(events.data.at(0)?.messageId).toEqual(message2.id);
  });

  it("should find on status scheduled", async () => {
    const orgId = randomUUID().substring(0, 8);
    const message1 = await insertMockMessage(
      "subject 1",
      undefined,
      undefined,
      orgId,
    );
    const message2 = await insertMockMessage(
      "subject 2",
      undefined,
      undefined,
      orgId,
    );

    messagingEventLogger.log(MessagingEventType.scheduleMessage, {
      messageId: message1.id,
      organisationName: message1.organisation_id,
    });

    messagingEventLogger.log(MessagingEventType.deliverMessage, {
      messageId: message2.id,
      organisationName: message2.organisation_id,
    });

    await messagingEventLogger.commit();

    const events = await listMessageEvents({
      pagination: { offset: "0", limit: "100" },
      pool,
      organizationId: orgId,
      status: "scheduled",
    });

    expect(events.totalCount).toEqual(1);
    expect(events.data.at(0)?.messageId).toEqual(message1.id);
  });

  it("should find on status failed", async () => {
    const orgId = randomUUID().substring(0, 5);
    const message1 = await insertMockMessage(
      "subject 1",
      undefined,
      undefined,
      orgId,
    );
    const message2 = await insertMockMessage(
      "subject 2",
      undefined,
      undefined,
      orgId,
    );

    messagingEventLogger.log(MessagingEventType.scheduleMessageError, {
      messageId: message1.id,
      organisationName: message1.organisation_id,
    });

    messagingEventLogger.log(MessagingEventType.deliverMessage, {
      messageId: message2.id,
      organisationName: message2.organisation_id,
    });

    await messagingEventLogger.commit();

    const events = await listMessageEvents({
      pagination: { offset: "0", limit: "100" },
      pool,
      organizationId: orgId,
      status: "failed",
    });

    expect(events.totalCount).toEqual(1);
    expect(events.data.at(0)?.messageId).toEqual(message1.id);
  });

  it("should find on status opened thanks to event", async () => {
    const orgId = randomUUID().substring(0, 6);
    const message1 = await insertMockMessage(
      "subject 1",
      undefined,
      true,
      orgId,
    );
    const message2 = await insertMockMessage(
      "subject 2",
      undefined,
      undefined,
      orgId,
    );

    messagingEventLogger.log(MessagingEventType.deliverMessage, {
      messageId: message1.id,
      organisationName: message1.organisation_id,
    });

    messagingEventLogger.log(MessagingEventType.deliverMessage, {
      messageId: message2.id,
      organisationName: message2.organisation_id,
    });

    await messagingEventLogger.commit();

    // should not return event at this point,
    // because message is set as seen in messages table
    // but the listMessageEvents must be based on
    // event logs table only
    const events = await listMessageEvents({
      pagination: { offset: "0", limit: "100" },
      pool,
      organizationId: orgId,
      status: "opened",
    });

    expect(events.totalCount).toEqual(0);

    messagingEventLogger.log(MessagingEventType.citizenSeenMessage, {
      messageId: message1.id,
      organisationName: message1.organisation_id,
    });
    await messagingEventLogger.commit();

    const eventsSecondRound = await listMessageEvents({
      pagination: { offset: "0", limit: "100" },
      pool,
      organizationId: orgId,
      status: "opened",
    });

    expect(eventsSecondRound.totalCount).toEqual(1);
    expect(eventsSecondRound.data.at(0)?.messageId).toEqual(message1.id);
  });

  it("should find by message id", async () => {
    const createdMockMessages = [];
    for (let i = 0; i < 5; i++) {
      const message = await insertMockMessage(`sub-another-${i}`);
      messagingEventLogger.log(MessagingEventType.createRawMessage, {
        messageId: message.id,
        organisationName: message.organisation_id,
        receiverFullName: message.user_id,
      });
      messagingEventLogger.log(MessagingEventType.deliverMessage, {
        messageId: message.id,
        organisationName: message.organisation_id,
        receiverFullName: message.user_id,
      });
      createdMockMessages.push(message);
    }

    await messagingEventLogger.commit();
    const listed = await listMessageEvents({
      pagination: { offset: "0", limit: "100" },
      pool,
      organizationId: organizationId,
      messageId: createdMockMessages[0].id,
    });

    expect(listed.totalCount).toBe(1);
    expect(listed.data[0].messageId, createdMockMessages[0].id);
    expect(listed.data[0].eventType, MessagingEventType.deliverMessage.key);
    expect(
      listed.data[0].eventStatus,
      MessagingEventType.deliverMessage.status,
    );
  });
});

describe("Message Event Logger - syncSummaryForMessage integration", () => {
  it("should create and update summary when events are committed", async () => {
    const orgId = randomUUID().substring(0, 7);
    const message = await insertMockMessage(
      "summary-subject",
      undefined,
      undefined,
      orgId,
    );
    // Log two events for the same message
    messagingEventLogger.log(MessagingEventType.createRawMessage, {
      messageId: message.id,
      organisationName: message.organisation_id,
      receiverFullName: message.user_id,
    });
    messagingEventLogger.log(MessagingEventType.deliverMessage, {
      messageId: message.id,
      organisationName: message.organisation_id,
    });
    await messagingEventLogger.commit();

    const summaryRes = await pool.query(
      "SELECT * FROM message_event_summary WHERE message_id = $1",
      [message.id],
    );
    expect(summaryRes.rowCount).toBe(1);
    const summary = summaryRes.rows[0];
    expect(summary.subject).toBe("summary-subject");
    expect(summary.event_type).toBe(MessagingEventType.deliverMessage.key);
    expect(summary.event_status).toBe(MessagingEventType.deliverMessage.status);

    // Add another event and sync again
    messagingEventLogger.log(MessagingEventType.citizenSeenMessage, {
      messageId: message.id,
      organisationName: message.organisation_id,
    });
    await messagingEventLogger.commit();

    const updatedSummaryRes = await pool.query(
      "SELECT * FROM message_event_summary WHERE message_id = $1",
      [message.id],
    );
    expect(updatedSummaryRes.rowCount).toBe(1);
    const updatedSummary = updatedSummaryRes.rows[0];
    expect(updatedSummary.event_type).toBe(
      MessagingEventType.citizenSeenMessage.key,
    );
    expect(updatedSummary.event_status).toBe(
      MessagingEventType.citizenSeenMessage.status,
    );
  });

  it("should not create summary if no events exist for the message", async () => {
    const orgId = randomUUID().substring(0, 7);
    const message = await insertMockMessage(
      "no-events-summary",
      undefined,
      undefined,
      orgId,
    );

    const summaryRes = await pool.query(
      "SELECT * FROM message_event_summary WHERE message_id = $1",
      [message.id],
    );
    expect(summaryRes.rowCount).toBe(0);
  });
});

describe("Message Event Service - getEvents for message id", () => {
  it("should process messages successfully", async () => {
    const message = await insertMockMessage();
    messagingEventLogger.log(MessagingEventType.createRawMessage, {
      messageId: message.id,
      organisationName: message.organisation_id,
      receiverFullName: message.user_id,
    });
    messagingEventLogger.log(MessagingEventType.deliverMessage, {
      messageId: message.id,
    });
    await messagingEventLogger.commit();

    const single = await getEventsForMessageId({
      messageId: message.id,
      organizationId: message.organisation_id,
      pool,
    });

    expect(single.length).toBe(2);

    expect(single[0].messageId).toBe(message.id);
    expect(single[1].messageId).toBe(message.id);
    expect(single[0].eventType).toBe(MessagingEventType.deliverMessage.key);
    expect(single[1].eventType).toBe(MessagingEventType.createRawMessage.key);
  });

  it("should handle errors if no event for message id exists", async () => {
    await expect(
      getEventsForMessageId({
        messageId: randomUUID(),
        organizationId: randomUUID(),
        pool,
      }),
    ).rejects.toThrow("No message event found for the organization");
  });

  it("should prevent accessing events from other organizations", async () => {
    // Create event in correct organization
    const correctOrgMessage = await insertMockMessage();
    messagingEventLogger.log(MessagingEventType.createRawMessage, {
      messageId: correctOrgMessage.id,
      organisationName: correctOrgMessage.organisation_id,
      receiverFullName: correctOrgMessage.user_id,
    });
    await messagingEventLogger.commit();

    await expect(
      getEventsForMessageId({
        messageId: correctOrgMessage.id,
        organizationId: "another-org-id",
        pool,
      }),
    ).rejects.toThrow("No message event found for the organization");
  });
});
