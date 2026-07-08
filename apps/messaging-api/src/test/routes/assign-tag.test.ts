import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "../build-testcontainer-pg.js";
import { build } from "../test-server-builder.js";

const userId = "asgn-usr-01";
const otherUserId = "asgn-usr-02";
const linkedChildId = "asgn-child-1";

// The move flow resolves linked profiles via the personal profile SDK so a
// user can move messages addressed to a profile they are linked to. Mock it so
// `userId`'s only linked profile is `linkedChildId`; everyone else has none.
vi.mock("../../utils/authentication-factory.js", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("../../utils/authentication-factory.js")
    >();

  return {
    ...original,
    getPersonalProfileSdk: vi.fn().mockResolvedValue({
      getProfile: vi.fn((id: string) => ({
        data: {
          id,
          linkedProfiles: id === userId ? [{ id: linkedChildId }] : [],
        },
      })),
    }),
  };
});

async function getServer(overrideUserId = userId): Promise<FastifyInstance> {
  const server = await build();
  server.addHook("onRequest", async (req: FastifyRequest) => {
    server.checkPermissions = async (
      request: FastifyRequest,
      _reply: FastifyReply,
      _permissions: string[],
      _matchConfig?: { method: "AND" | "OR" },
    ) => {
      req.userData = {
        userId: overrideUserId,
        accessToken: "accesstoken",
        organizationId: undefined,
        isM2MApplication: false,
      };
      request.userData = req.userData;
    };
  });
  return server;
}

let pool: Pool;
let app: FastifyInstance | undefined;
let messageId: string;
let tagId: string;

beforeAll(async () => {
  pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
});

afterAll(async () => {
  if (pool) {
    await pool.end();
  }
});

beforeEach(async () => {
  // Clean up previous test data
  await pool.query(
    `UPDATE messages SET tag_id = NULL WHERE user_id IN ($1, $2)`,
    [userId, otherUserId],
  );
  await pool.query(`DELETE FROM tags WHERE user_id IN ($1, $2)`, [
    userId,
    otherUserId,
  ]);

  // Create a message for the user
  const msgRes = await pool.query<{ id: string }>(
    `INSERT INTO messages(user_id, subject, excerpt, plain_text, rich_text, security_level, lang, preferred_transports, thread_name, organisation_id, scheduled_at, is_delivered, is_seen)
     VALUES($1, 'subj', 'exc', 'pt', 'rt', 'public', 'en', '{""}', 'tn', 'org1', now(), true, false)
     RETURNING id`,
    [userId],
  );
  messageId = msgRes.rows[0].id;

  // Create a tag for the user
  const tagRes = await pool.query<{ id: string }>(
    `INSERT INTO tags(user_id, label, path) VALUES($1, 'TestTag', replace(gen_random_uuid()::text, '-', '')::ltree) RETURNING id`,
    [userId],
  );
  tagId = tagRes.rows[0].id;
});

afterEach(async () => {
  if (app) {
    app.close();
    app = undefined;
  }
  // Final cleanup
  await pool.query(
    `UPDATE messages SET tag_id = NULL WHERE user_id IN ($1, $2, $3)`,
    [userId, otherUserId, linkedChildId],
  );
  await pool.query(
    `DELETE FROM messages WHERE user_id IN ($1, $2, $3) AND subject = 'subj'`,
    [userId, otherUserId, linkedChildId],
  );
  await pool.query(`DELETE FROM tags WHERE user_id IN ($1, $2)`, [
    userId,
    otherUserId,
  ]);
});

// ─── PUT /api/v1/messages/:messageId/tag (Route-level) ──────────────────────

describe("PUT /api/v1/messages/:messageId/tag", () => {
  it("assigns a tag to a message and returns 200", async () => {
    app = await getServer();
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/messages/tags`,
      body: { tagId, messageIds: [messageId] },
    });

    expect(res.statusCode).toBe(200);
    const { messageIds: returnedMessageIds, tagId: returnedTagId } =
      res.json().data;
    expect(returnedMessageIds).toStrictEqual([messageId]);
    expect(returnedTagId).toBe(tagId);

    // Verify assignment in DB
    const dbRes = await pool.query(
      `SELECT tag_id FROM messages WHERE id = $1`,
      [messageId],
    );
    expect(dbRes.rows[0].tag_id).toBe(tagId);
  });

  it("removes a tag (null) and returns 200", async () => {
    // First assign the tag
    await pool.query(`UPDATE messages SET tag_id = $1 WHERE id = $2`, [
      tagId,
      messageId,
    ]);

    app = await getServer();
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/messages/tags`,
      body: { tagId: null, messageIds: [messageId] },
    });

    expect(res.statusCode).toBe(200);

    const dbRes = await pool.query(
      `SELECT tag_id FROM messages WHERE id = $1`,
      [messageId],
    );
    expect(dbRes.rows[0].tag_id).toBeNull();
  });

  it("returns 404 for non-existent message", async () => {
    app = await getServer();
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/messages/tags`,
      body: { tagId, messageIds: [randomUUID()] },
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 404 for non-existent tag", async () => {
    app = await getServer();
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/messages/tags`,
      body: { tagId: randomUUID(), messageIds: [messageId] },
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 404 when message belongs to another user", async () => {
    // Create a message for the other user
    const otherMsg = await pool.query<{ id: string }>(
      `INSERT INTO messages(user_id, subject, excerpt, plain_text, rich_text, security_level, lang, preferred_transports, thread_name, organisation_id, scheduled_at, is_delivered, is_seen)
       VALUES($1, 'subj', 'exc', 'pt', 'rt', 'public', 'en', '{""}', 'tn', 'org1', now(), true, false)
       RETURNING id`,
      [otherUserId],
    );

    app = await getServer(); // logged in as userId
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/messages/tags`,
      body: { tagId, messageIds: [otherMsg.rows[0].id] },
    });

    expect(res.statusCode).toBe(404);
  });

  it("assigns a tag to a linked profile's message and returns 200", async () => {
    // Message addressed to a profile the logged-in user is linked to. This is
    // the inbox case that previously 404'd (AB#40427).
    const linkedMsg = await pool.query<{ id: string }>(
      `INSERT INTO messages(user_id, subject, excerpt, plain_text, rich_text, security_level, lang, preferred_transports, thread_name, organisation_id, scheduled_at, is_delivered, is_seen)
       VALUES($1, 'subj', 'exc', 'pt', 'rt', 'public', 'en', '{""}', 'tn', 'org1', now(), true, false)
       RETURNING id`,
      [linkedChildId],
    );

    app = await getServer(); // logged in as userId, linked to linkedChildId
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/messages/tags`,
      body: { tagId, messageIds: [linkedMsg.rows[0].id] },
    });

    expect(res.statusCode).toBe(200);

    const dbRes = await pool.query(
      `SELECT tag_id FROM messages WHERE id = $1`,
      [linkedMsg.rows[0].id],
    );
    expect(dbRes.rows[0].tag_id).toBe(tagId);
  });

  it("returns 404 when tag belongs to another user", async () => {
    // Create a tag for the other user
    const otherTag = await pool.query<{ id: string }>(
      `INSERT INTO tags(user_id, label, path) VALUES($1, 'OtherTag', replace(gen_random_uuid()::text, '-', '')::ltree) RETURNING id`,
      [otherUserId],
    );

    app = await getServer(); // logged in as userId
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/messages/tags`,
      body: { tagId: otherTag.rows[0].id, messageIds: [messageId] },
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 422 for invalid messageId format", async () => {
    app = await getServer();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/messages/tags",
      body: { tagId, messageIds: ["not-a-uuid"] },
    });

    expect(res.statusCode).toBe(422);
  });
});
