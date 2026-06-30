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
} from "vitest";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "../build-testcontainer-pg.js";
import { build } from "../test-server-builder.js";

const userId = "tag-rt-usr1";

async function getServer(
  overrideUserId = userId,
  organizationId?: string,
): Promise<FastifyInstance> {
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
        organizationId,
        isM2MApplication: false,
      };
      request.userData = req.userData;
    };
  });
  return server;
}

let pool: Pool;
let app: FastifyInstance | undefined;

beforeAll(() => {
  pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
});

afterAll(async () => {
  if (pool) {
    await pool.end();
  }
});

beforeEach(async () => {
  await pool.query(`DELETE FROM tags WHERE user_id = $1`, [userId]);
});

afterEach(() => {
  if (app) {
    app.close();
    app = undefined;
  }
});

// ─── POST /api/v1/tags ───────────────────────────────────────────────────────

describe("POST /api/v1/tags", () => {
  it("creates a tag and returns 201", async () => {
    app = await getServer();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/tags",
      body: { label: "Work" },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data).toHaveProperty("id");
  });

  it("returns 422 when label is missing", async () => {
    app = await getServer();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/tags",
      body: {},
    });

    expect(res.statusCode).toBe(422);
  });

  it("returns 422 when parentTagId is not a valid UUID", async () => {
    app = await getServer();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/tags",
      body: { label: "Test", parentTagId: "not-a-uuid" },
    });

    expect(res.statusCode).toBe(422);
  });
});

// ─── PATCH /api/v1/tags/:tagId ───────────────────────────────────────────────

describe("PATCH /api/v1/tags/:tagId", () => {
  it("updates tag name and returns 200", async () => {
    app = await getServer();

    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/tags",
      body: { label: "Old" },
    });
    const tagId = createRes.json().data.id;

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/tags/${tagId}`,
      body: { label: "New" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(tagId);
  });

  it("updates tag parent and returns 200", async () => {
    app = await getServer();

    const parent = await app.inject({
      method: "POST",
      url: "/api/v1/tags",
      body: { label: "ParentTag" },
    });
    const parentId = parent.json().data.id;

    const child = await app.inject({
      method: "POST",
      url: "/api/v1/tags",
      body: { label: "ChildTag" },
    });
    const childId = child.json().data.id;

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/tags/${childId}`,
      body: { parentTagId: parentId },
    });

    expect(res.statusCode).toBe(200);
  });

  it("returns 404 for non-existent tag", async () => {
    app = await getServer();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/tags/${randomUUID()}`,
      body: { label: "Nope" },
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 422 for invalid tagId format", async () => {
    app = await getServer();
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/tags/not-a-uuid",
      body: { label: "Bad" },
    });

    expect(res.statusCode).toBe(422);
  });
});

// ─── GET /api/v1/tags ────────────────────────────────────────────────────────

describe("GET /api/v1/tags", () => {
  it("returns flat list of tags", async () => {
    app = await getServer();

    await app.inject({
      method: "POST",
      url: "/api/v1/tags",
      body: { label: "Alpha" },
    });
    await app.inject({
      method: "POST",
      url: "/api/v1/tags",
      body: { label: "Beta" },
    });

    const res = await app.inject({ method: "GET", url: "/api/v1/tags" });

    expect(res.statusCode).toBe(200);
    const tags = res.json().data;
    expect(tags).toHaveLength(2);
    expect(tags[0].label).toBe("Alpha");
    expect(tags[1].label).toBe("Beta");
  });

  it("returns empty list for user with no tags", async () => {
    app = await getServer();
    const res = await app.inject({ method: "GET", url: "/api/v1/tags" });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(0);
  });
});

// ─── GET /api/v1/tags/tree ───────────────────────────────────────────────────

describe("GET /api/v1/tags/tree", () => {
  it("returns nested tree structure", async () => {
    app = await getServer();

    const rootRes = await app.inject({
      method: "POST",
      url: "/api/v1/tags",
      body: { label: "Root" },
    });
    const rootId = rootRes.json().data.id;

    await app.inject({
      method: "POST",
      url: "/api/v1/tags",
      body: { label: "Child", parentTagId: rootId },
    });

    const res = await app.inject({ method: "GET", url: "/api/v1/tags/tree" });

    expect(res.statusCode).toBe(200);
    const tree = res.json().data;
    expect(tree).toHaveLength(1);
    expect(tree[0].label).toBe("Root");
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].label).toBe("Child");
  });

  it("returns empty tree for user with no tags", async () => {
    app = await getServer();
    const res = await app.inject({ method: "GET", url: "/api/v1/tags/tree" });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([]);
  });
});

// ─── DELETE /api/v1/tags/:tagId ──────────────────────────────────────────────

describe("DELETE /api/v1/tags/:tagId", () => {
  it("deletes a tag and returns 200", async () => {
    app = await getServer();

    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/tags",
      body: { label: "Temp" },
    });
    const tagId = createRes.json().data.id;

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/tags/${tagId}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(tagId);
  });

  it("reassigns attached messages to the inbox and returns 200", async () => {
    app = await getServer();

    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/tags",
      body: { label: "WithMsg" },
    });
    const tagId = createRes.json().data.id;

    // Attach a message to the tag via SQL
    const insertRes = await pool.query<{ id: string }>(
      `INSERT INTO messages(user_id, subject, excerpt, plain_text, rich_text, security_level, lang, preferred_transports, thread_name, organisation_id, scheduled_at, is_delivered, is_seen, tag_id)
       VALUES($1, 's', 'e', 'pt', 'rt', 'public', 'en', '{""}', 'tn', 'org1', now(), true, false, $2)
       RETURNING id`,
      [userId, tagId],
    );
    const messageId = insertRes.rows[0].id;

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/tags/${tagId}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(tagId);

    // The message is reassigned to the inbox (tag_id NULL), not deleted.
    const messageRes = await pool.query<{ tag_id: string | null }>(
      `SELECT tag_id FROM messages WHERE id = $1`,
      [messageId],
    );
    expect(messageRes.rows).toHaveLength(1);
    expect(messageRes.rows[0].tag_id).toBeNull();

    // Cleanup
    await pool.query(`DELETE FROM messages WHERE id = $1`, [messageId]);
  });

  it("returns 404 for non-existent tag", async () => {
    app = await getServer();
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/tags/${randomUUID()}`,
    });

    expect(res.statusCode).toBe(404);
  });
});

// ─── Permissions ─────────────────────────────────────────────────────────────
// Permission checks (401/403) are covered by the shared checkPermissions
// hook and are tested in the auth integration tests. Route-level mock
// overrides checkPermissions, so we cannot test denial here.
