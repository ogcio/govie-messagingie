import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { syncSummaryForMessage } from "../../../services/messages/summary-event-logger.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "../../build-testcontainer-pg.js";

let pool: Pool;
const organizationId = "summary-event-org";
const insertedMessageIds: Set<string> = new Set();
beforeAll(() => {
  pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
});

afterAll(async () => {
  if (pool) {
    await pool.end();
  }
});

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

async function insertMessage(
  subject: string,
  organisationId: string,
  pool: Pool,
): Promise<string> {
  const qres = await pool.query(
    `
    INSERT INTO messages(
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
    ) VALUES (
      true,
      $1,
      $2,
      'exc',
      'pt',
      'rt',
      'public',
      'en',
      $3,
      'tn',
      $4,
      now(),
      false
    )
    RETURNING id
    `,
    ["user-id", subject, "{}", organisationId],
  );
  insertedMessageIds.add(qres.rows[0].id);

  return qres.rows[0].id as string;
}

async function insertEventLog(
  messageId: string,
  eventType: string,
  eventStatus: string,
  createdAt: string,
  data: Record<string, string | null | undefined | number | boolean> = {},
): Promise<string> {
  const qres = await pool.query(
    `
    INSERT INTO messaging_event_logs(
      message_id,
      event_type,
      event_status,
      data,
      created_at
    ) VALUES (
      $1, $2, $3, $4, $5
    )
    RETURNING id
    `,
    [messageId, eventType, eventStatus, data, createdAt],
  );
  return qres.rows[0].id as string;
}

describe("Summary Event Logger", () => {
  it("should create a summary for a message with events", async () => {
    const subject = "Test Subject";
    const messageId = await insertMessage(subject, organizationId, pool);

    await insertEventLog(
      messageId,
      "created",
      "pending",
      new Date(Date.now() - 10000).toISOString(),
      { foo: "bar" },
    );
    await insertEventLog(
      messageId,
      "delivered",
      "success",
      new Date().toISOString(),
      { baz: "qux" },
    );

    await syncSummaryForMessage({ messageId, pool });

    const summaryRes = await pool.query(
      "SELECT * FROM message_event_summary WHERE message_id = $1",
      [messageId],
    );
    expect(summaryRes.rowCount).toBe(1);
    const summary = summaryRes.rows[0];
    expect(summary.subject).toBe(subject);
    expect(summary.event_type).toBe("delivered");
    expect(summary.event_status).toBe("success");
    expect(summary.data).toMatchObject({ foo: "bar", baz: "qux" });
  });

  it("should update summary when new events are added", async () => {
    const subject = "Test Subject";
    const messageId = await insertMessage(subject, organizationId, pool);

    await insertEventLog(
      messageId,
      "created",
      "pending",
      new Date(Date.now() - 20000).toISOString(),
      { foo: "bar" },
    );

    await syncSummaryForMessage({ messageId, pool });

    await insertEventLog(
      messageId,
      "read",
      "success",
      new Date().toISOString(),
      { read: true },
    );

    await syncSummaryForMessage({ messageId, pool });

    const summaryRes = await pool.query(
      "SELECT * FROM message_event_summary WHERE message_id = $1",
      [messageId],
    );
    expect(summaryRes.rowCount).toBe(1);
    const summary = summaryRes.rows[0];
    expect(summary.event_type).toBe("read");
    expect(summary.event_status).toBe("success");
    expect(summary.data).toMatchObject({ foo: "bar", read: true });
  });

  it("should not create summary if no events exist", async () => {
    const subject = "Test Subject";
    const messageId = await insertMessage(subject, organizationId, pool);

    await syncSummaryForMessage({ messageId, pool });

    const summaryRes = await pool.query(
      "SELECT * FROM message_event_summary WHERE message_id = $1",
      [messageId],
    );
    expect(summaryRes.rowCount).toBe(0);
  });
});
