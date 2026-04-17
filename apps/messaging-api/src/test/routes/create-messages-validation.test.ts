import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { afterEach, describe, expect, it, suite } from "vitest";
import { build } from "../test-server-builder.js";

describe("POST /api/v1/messages", {}, () => {
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
        // biome-ignore lint/complexity/noUselessLoneBlockStatements: it's used
        {
          req.userData = {
            userId: "userId",
            accessToken: "accessToken",
            organizationId: "organisationId",
            isM2MApplication: false,
          };

          request.userData = req.userData;
        }
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

  suite("create message schema validations", () => {
    it("with illegal preferredTransports should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/messages",
        body: {
          preferredTransports: ["air", "earth", "bear"],
          recipientUserId: "",
          security: "confidential",
          scheduleAt: "",
          message: {
            threadName: "name",
            subject: "subject",
            excerpt: "excerpt",
            plainText: "text",
            richText: "text",
            language: "en",
          },
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe(
        "body/preferredTransports/0 must be equal to one of the allowed values",
      );
    });

    it("with null preferredTransports should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/messages",
        body: {
          security: "confidential",
          preferredTransports: null,
          recipientUserId: "",
          scheduleAt: "",
          message: {
            threadName: "kk",
            subject: "subject",
            excerpt: "excerpt",
            plainText: "text",
            richText: "text",
            language: "en",
          },
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe("body/preferredTransports must be array");
    });

    it("with illegal security should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/messages",
        body: {
          security: "illegal",
          preferredTransports: [],
          recipientUserId: "",
          scheduleAt: "",
          message: {
            threadName: "name",
            subject: "subject",
            excerpt: "excerpt",
            plainText: "text",
            richText: "text",
            language: "en",
          },
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe(
        "body/security must be equal to one of the allowed values",
      );
    });

    it("with null security should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/messages",
        body: {
          security: null,
          preferredTransports: [],
          recipientUserId: "",
          scheduleAt: "",
          message: {
            threadName: "kk",
            subject: "subject",
            excerpt: "excerpt",
            plainText: "text",
            richText: "text",
            language: "en",
          },
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe("body/security must be string");
    });

    it("with null recipientUserId should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/messages",
        body: {
          security: "illegal",
          preferredTransports: [],
          recipientUserId: null,
          scheduleAt: "",
          message: {
            threadName: "name",
            subject: "subject",
            excerpt: "excerpt",
            plainText: "text",
            richText: "text",
            language: "en",
          },
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe("body/recipientUserId must be string");
    });

    it("with no recipientUserId should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/messages",
        body: {
          security: "illegal",
          preferredTransports: [],
          scheduleAt: "",
          message: {
            threadName: "name",
            subject: "subject",
            excerpt: "excerpt",
            plainText: "text",
            richText: "text",
            language: "en",
          },
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe(
        "body must have required property 'recipientUserId'",
      );
    });

    it("with null scheduleAt should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/messages",
        body: {
          security: "public",
          preferredTransports: [],
          recipientUserId: "id",
          scheduleAt: null,
          message: {
            threadName: "name",
            subject: "subject",
            excerpt: "excerpt",
            plainText: "text",
            richText: "text",
            language: "en",
          },
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe("body/scheduleAt must be string");
    });

    it("with illegal scheduleAt should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/messages",
        body: {
          security: "public",
          preferredTransports: [],
          recipientUserId: "id",
          scheduleAt: "not a date time",
          message: {
            threadName: "name",
            subject: "subject",
            excerpt: "excerpt",
            plainText: "text",
            richText: "text",
            language: "en",
          },
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe('body/scheduleAt must match format "date-time"');
    });

    it("with null message.threadName should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/messages",
        body: {
          security: "public",
          preferredTransports: [],
          recipientUserId: "id",
          scheduleAt: "2024-08-27T07:46:10.290Z",
          message: {
            threadName: null,
            subject: "subject",
            excerpt: "excerpt",
            plainText: "text",
            richText: "text",
            language: "en",
          },
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe("body/message/threadName must be string");
    });

    it("with null message.subject should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/messages",
        body: {
          security: "public",
          preferredTransports: [],
          recipientUserId: "id",
          scheduleAt: "2024-08-27T07:46:10.290Z",
          message: {
            threadName: "thread",
            subject: null,
            excerpt: "excerpt",
            plainText: "text",
            richText: "text",
            language: "en",
          },
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe("body/message/subject must be string");
    });

    it("with no message.subject should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/messages",
        body: {
          security: "public",
          preferredTransports: [],
          recipientUserId: "id",
          scheduleAt: "2024-08-27T07:46:10.290Z",
          message: {
            threadName: "thread",
            excerpt: "excerpt",
            plainText: "text",
            richText: "text",
            language: "en",
          },
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe(
        "body/message must have required property 'subject'",
      );
    });

    it("with null message.excerpt should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/messages",
        body: {
          security: "public",
          preferredTransports: [],
          recipientUserId: "id",
          scheduleAt: "2024-08-27T07:46:10.290Z",
          message: {
            threadName: "thread",
            subject: "subject",
            excerpt: null,
            plainText: "text",
            richText: "text",
            language: "en",
          },
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe("body/message/excerpt must be string");
    });

    it("with null message.plainText should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/messages",
        body: {
          security: "public",
          preferredTransports: [],
          recipientUserId: "id",
          scheduleAt: "2024-08-27T07:46:10.290Z",
          message: {
            threadName: "thread",
            subject: "subject",
            excerpt: "exc",
            plainText: null,
            richText: "text",
            language: "en",
          },
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe("body/message/plainText must be string");
    });

    it("with no message.plainText should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/messages",
        body: {
          security: "public",
          preferredTransports: [],
          recipientUserId: "id",
          scheduleAt: "2024-08-27T07:46:10.290Z",
          message: {
            threadName: "thread",
            subject: "subject",
            excerpt: "exc",
            richText: "text",
            language: "en",
          },
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe(
        "body/message must have required property 'plainText'",
      );
    });

    it("with null message.language should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/messages",
        body: {
          security: "public",
          preferredTransports: [],
          recipientUserId: "id",
          scheduleAt: "2024-08-27T07:46:10.290Z",
          message: {
            threadName: "thread",
            subject: "subject",
            excerpt: "exc",
            plainText: "text",
            richText: "text",
            language: null,
          },
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe("body/message/language must be string");
    });

    it("with no message.language should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/messages",
        body: {
          security: "public",
          preferredTransports: [],
          recipientUserId: "id",
          scheduleAt: "2024-08-27T07:46:10.290Z",
          message: {
            threadName: "thread",
            subject: "subject",
            excerpt: "exc",
            plainText: "text",
            richText: "text",
          },
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe(
        "body/message must have required property 'language'",
      );
    });

    it("with illegal message.language should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/messages",
        body: {
          security: "public",
          preferredTransports: [],
          recipientUserId: "id",
          scheduleAt: "2024-08-27T07:46:10.290Z",
          message: {
            threadName: "thread",
            subject: "subject",
            excerpt: "exc",
            plainText: "text",
            richText: "text",
            language: "sv",
          },
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe(
        "body/message/language must be equal to one of the allowed values",
      );
    });
  });
});
