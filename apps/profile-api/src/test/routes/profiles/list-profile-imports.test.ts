import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build } from "~/test/test-server-builder.js";

describe("GET /api/v1/profiles/imports", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await build();

    app.addHook("onRequest", async (req: FastifyRequest) => {
      // Override the request decorator
      app.checkPermissions = async (
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
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it("should reject invalid source values", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/profiles/imports?source=invalid",
    });

    expect(response.statusCode).toBe(422);
  });
});
