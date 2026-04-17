import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { utils } from "../../utils/utils.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "../build-testcontainer-pg.js";
import { build } from "../test-server-builder.js";

// Please note
// This test file only contains the test cases
// that do not make use of the ProfileSDKWrapper
// to avoid building complex logics to
// mock it through another server.
// that code will be tested in the services folder

describe("DELETE /api/v1/messages", {}, () => {
  let pool: Pool;

  beforeAll(() => {
    pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  let app: FastifyInstance | undefined;

  afterEach(() => {
    if (app) {
      app.close();
      app = undefined;
    }
  });

  it("should return 403 if public servant is logged in", async () => {
    const userId = randomUUID().substring(0, 12);
    app = await getServer(userId, "pub-ser");

    const res = await app.inject({
      method: "DELETE",
      url: "/api/v1/messages",
      payload: { ids: [randomUUID()] },
    });

    expect(res.statusCode).toBe(403);
  });

  it("should return 422 if body is empty", async () => {
    const userId = randomUUID().substring(0, 12);
    app = await getServer(userId, undefined);

    const res = await app.inject({
      method: "DELETE",
      url: "/api/v1/messages",
      payload: {},
    });

    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("should return 422 if ids is not an array", async () => {
    const userId = randomUUID().substring(0, 12);
    app = await getServer(userId, undefined);

    const res = await app.inject({
      method: "DELETE",
      url: "/api/v1/messages",
      payload: { ids: "not-an-array" },
    });

    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.detail).toBe("body/ids must be array");
  });

  it("should return 422 if ids is an empty array", async () => {
    const userId = randomUUID().substring(0, 12);
    app = await getServer(userId, undefined);

    const res = await app.inject({
      method: "DELETE",
      url: "/api/v1/messages",
      payload: { ids: [] },
    });

    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("should return 422 if ids contains non-uuid values", async () => {
    const userId = randomUUID().substring(0, 12);
    app = await getServer(userId, undefined);

    const res = await app.inject({
      method: "DELETE",
      url: "/api/v1/messages",
      payload: { ids: ["not-a-uuid"] },
    });

    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.detail).toBe('body/ids/0 must match format "uuid"');
  });

  it("should return 200 and soft-delete a message with correct response format", async () => {
    const userId = randomUUID().substring(0, 12);
    const organisationId = "org-single";
    const message = await insertMessage(userId, organisationId, pool);

    app = await getServer(userId, undefined);

    const res = await app.inject({
      method: "DELETE",
      url: "/api/v1/messages",
      payload: { ids: [message.id] },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.ids).toStrictEqual([message.id]);
  });
});

async function getServer(
  userId: string,
  organizationId: string | undefined,
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
        userId,
        accessToken: "accesstoken",
        organizationId,
        isM2MApplication: false,
      };
      request.userData = req.userData;
    };
  });

  return server;
}

async function insertMessage(
  recipientProfileId: string,
  organisationId: string,
  pool: Pool,
) {
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
      is_seen)
    VALUES(
      true,
      $1,
      's',
      'exc',
      'pt',
      'rich',
      'public',
      'en',
      $2,
      'thread',
      $3,
      now(),
      false)
    RETURNING id
    `,
    [recipientProfileId, utils.postgresArrayify([""]), organisationId],
  );
  return qres.rows[0] as { id: string };
}
