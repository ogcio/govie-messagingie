import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { afterEach, describe, expect, it, suite } from "vitest";
import { build } from "../test-server-builder.js";

describe("/api/v1/jobs", {}, () => {
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

  suite("execute job schema validations", () => {
    it("should fail with illegal jobId url parameter", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/jobs/123",
        body: {
          token: "valid-token",
        },
      });

      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe('params/jobId must match format "uuid"');
    });

    it("should fail with null token in body", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/jobs/ca3b108f-7b9a-487e-b40a-eb535e6056ca",
        body: {
          token: null,
        },
      });

      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe("body/token must be string");
    });

    it("should fail with no token in body", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/jobs/ca3b108f-7b9a-487e-b40a-eb535e6056ca",
        body: {},
      });

      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe("body must have required property 'token'");
    });

    it("should fail if jobId param is not a uuid", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/jobs/not-a-uuid",
        body: {
          token: "valid-token",
        },
      });

      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe('params/jobId must match format "uuid"');
    });
  });
});
