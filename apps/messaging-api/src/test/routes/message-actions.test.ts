import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { afterEach, describe, expect, it, suite } from "vitest";
import { build } from "../test-server-builder.js";

describe("/api/v1/message-actions", {}, () => {
  const getServer = async (): Promise<FastifyInstance> => {
    const server = await build();
    server.addHook("onRequest", async (req: FastifyRequest) => {
      // Override the request decorator
      server.checkPermissions = async (
        request: FastifyRequest,
        _reply: FastifyReply,
        _permissions: string[],
        _matchConfig?: { method: "AND" | "OR" },
      ) => {
        req.userData = {
          userId: "userId",
          accessToken: "accessToken",
          organizationId: "organisationId",
          isM2MApplication: false,
        };

        request.userData = req.userData;
      };
    });

    return server;
  };

  let app: FastifyInstance | undefined;

  afterEach(() => {
    if (app) {
      app.close();
      app = undefined;
    }
  });

  suite("update message action schema validations", () => {
    it("with illegal messageId url parameter should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/message-actions/123",
        body: {
          messageId: "123",
          isSeen: true,
        },
      });

      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe('params/messageId must match format "uuid"');
    });

    it("with null messageId in body should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/message-actions/ca3b108f-7b9a-487e-b40a-eb535e6056ca",
        body: {
          messageId: null,
          isSeen: true,
        },
      });

      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe("body/messageId must be string");
    });

    it("with no messageId in body should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/message-actions/ca3b108f-7b9a-487e-b40a-eb535e6056ca",
        body: {
          isSeen: true,
        },
      });

      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe("body must have required property 'messageId'");
    });

    it("with mismatched messageId in url and body should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/message-actions/ca3b108f-7b9a-487e-b40a-eb535e6056ca",
        body: {
          messageId: "da3b108f-7b9a-487e-b40a-eb535e6056ca",
          isSeen: true,
        },
      });

      const body = await res.json();

      expect(res.statusCode).toBe(400);
      expect(body.detail).toBe("url params id mismatch with body id");
    });

    it("with null isSeen should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/message-actions/ca3b108f-7b9a-487e-b40a-eb535e6056ca",
        body: {
          messageId: "ca3b108f-7b9a-487e-b40a-eb535e6056ca",
          isSeen: null,
        },
      });

      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe("body/isSeen must be boolean");
    });

    it("with no isSeen should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/message-actions/ca3b108f-7b9a-487e-b40a-eb535e6056ca",
        body: {
          messageId: "ca3b108f-7b9a-487e-b40a-eb535e6056ca",
        },
      });

      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe("body must have required property 'isSeen'");
    });
  });
});
