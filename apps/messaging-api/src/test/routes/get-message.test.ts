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

describe("GET /api/v1/messages/{id}", {}, () => {
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

  it("should return 404 if message not exist with onboarding permission", async () => {
    app = await getServer(randomUUID().substring(0, 12), true);
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/messages/${randomUUID()}`,
    });

    expect(res.statusCode).toBe(404);
  });

  it("should return 404 if message not exist with self permission", async () => {
    app = await getServer(randomUUID().substring(0, 12), false);
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/messages/${randomUUID()}`,
    });

    expect(res.statusCode).toBe(404);
  });

  it("should return partial data if message exists for another user with onboarding permission", async () => {
    const loggedInUserId = randomUUID().substring(0, 12);
    const recipientUserId = randomUUID().substring(0, 12);
    const organisationId = "an-org";
    const message = await insertMessage(recipientUserId, organisationId, pool);

    app = await getServer(loggedInUserId, true);

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/messages/${message.id}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body).toStrictEqual({
      recipientUserId,
      organisationId,
    });
  });

  it("should return full data if message exists for itself with self permission", async () => {
    const loggedInUserId = randomUUID().substring(0, 12);
    const recipientUserId = loggedInUserId;
    const organisationId = "an-org";
    const message = await insertMessage(recipientUserId, organisationId, pool);

    app = await getServer(loggedInUserId, false);

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/messages/${message.id}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;

    const { id, ...rest } = body;
    expect(body).toStrictEqual(rest);
  });

  it("should return full data if message exists for itself with onboarding permission", async () => {
    const loggedInUserId = randomUUID().substring(0, 12);
    const recipientUserId = loggedInUserId;
    const organisationId = "an-org";
    const message = await insertMessage(recipientUserId, organisationId, pool);

    app = await getServer(loggedInUserId, true);

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/messages/${message.id}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;

    const { id, ...rest } = body;
    expect(body).toStrictEqual(rest);
  });

  it("with illegal id url parameter should fail", async () => {
    app = await getServer(randomUUID().substring(0, 12), true);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/messages/123",
    });

    const body = await res.json();

    expect(res.statusCode).toBe(422);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.detail).toBe('params/messageId must match format "uuid"');
  });

  it("should manage optional fields as expected", async () => {
    const loggedInUserId = randomUUID().substring(0, 12);
    const recipientUserId = loggedInUserId;
    const organisationId = "an-org";
    const message = await insertMessage(
      recipientUserId,
      organisationId,
      pool,
      true,
    );

    app = await getServer(loggedInUserId, false);

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/messages/${message.id}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;

    // Fastify, if one of the field doesn't match the return type,
    // and, as in this case, can return a smaller type (ReadMessage vs PartialRead)
    // strips all the non mandatory fields in the smaller type
    // Doing this check we can ensure that the optional fields
    // are managed as expected and then the fields available only in the
    // bigger type are returned too
    expect(body.plainText).toBeTypeOf("string");
    expect(body.threadName).toBeNull();
    expect(body.excerpt).toBeNull();
    expect(body.richText).toBeNull();
  });

  it("should return 404 for a soft-deleted message by default", async () => {
    const loggedInUserId = randomUUID().substring(0, 12);
    const message = await insertMessage(loggedInUserId, "an-org", pool);
    await pool.query("UPDATE messages SET deleted_at = now() WHERE id = $1", [
      message.id,
    ]);

    app = await getServer(loggedInUserId, false);
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/messages/${message.id}`,
    });

    expect(res.statusCode).toBe(404);
  });

  it("should return a soft-deleted message when deleted=true", async () => {
    const loggedInUserId = randomUUID().substring(0, 12);
    const message = await insertMessage(loggedInUserId, "an-org", pool);
    await pool.query("UPDATE messages SET deleted_at = now() WHERE id = $1", [
      message.id,
    ]);

    app = await getServer(loggedInUserId, false);
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/messages/${message.id}`,
      query: { deleted: "true" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.subject).toBeDefined();
  });

  it("should return 404 for an active message when deleted=true", async () => {
    const loggedInUserId = randomUUID().substring(0, 12);
    const message = await insertMessage(loggedInUserId, "an-org", pool);

    app = await getServer(loggedInUserId, false);
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/messages/${message.id}`,
      query: { deleted: "true" },
    });

    expect(res.statusCode).toBe(404);
  });
});

async function getServer(
  userId: string,
  hasOnboardingPermissions: boolean,
): Promise<FastifyInstance> {
  const server = await build();
  server.decorate("checkPermissionsCount", 0);
  server.addHook("onRequest", async (req: FastifyRequest) => {
    // Override the request decorator
    server.checkPermissions = async (
      request: FastifyRequest,
      _reply: FastifyReply,
      _permissions: string[],
      _matchConfig?: { method: "AND" | "OR" },
    ) => {
      const editableServer = server as unknown as {
        checkPermissionsCount: number;
      };
      const checkPermissionsCount = editableServer.checkPermissionsCount;
      // first check is done on incoming request
      if (checkPermissionsCount === 0) {
        req.userData = {
          userId,
          accessToken: "accesstoken",
          organizationId: "organisationId",
          isM2MApplication: false,
        };
        editableServer.checkPermissionsCount += 1;
        request.userData = req.userData;
        return;
      }

      // next check when getMessage invokes it
      if (!hasOnboardingPermissions) {
        throw new Error();
      }
    };
  });

  return server;
}

async function insertMessage(
  recipientProfileId: string,
  organisationId: string,
  pool: Pool,
  setNullOptionalFields?: boolean,
) {
  let [excerpt, richText, threadName]: (string | null)[] = [
    "exc",
    "rich",
    "thread",
  ];
  if (setNullOptionalFields === true) {
    [excerpt, richText, threadName] = [null, null, null];
  }
  const qres = await pool.query(
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
      is_seen)
    values(
      true,
      $1,
      's',
      $4,
      'pt',
      $5,
      'public',
      'en',
      $2,
      $6,
      $3,
      now(),
      false)
      returning id, 
        created_at as createdAt,
        excerpt,
        organisation_id as organisationId,
        plain_text as plainText,
        user_id as recipientUserId,
        rich_text as richText,
        security_level as security,
        subject,
        thread_name as threadName
  `,

    [
      recipientProfileId,
      utils.postgresArrayify([""]),
      organisationId,
      excerpt,
      richText,
      threadName,
    ],
  );
  const result = qres.rows[0];
  return {
    attachments: [],
    isSeen: false,
    ...result,
  };
}
