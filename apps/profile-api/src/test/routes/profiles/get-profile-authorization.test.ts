import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildOnce, type MockAuthConfig } from "~/test/test-server-builder.js";

describe("GET /api/v1/profiles/:profileId authorization", () => {
  let app: FastifyInstance;
  let setAuth: (config: MockAuthConfig) => void;

  beforeAll(async () => {
    const server = await buildOnce();
    app = server.app;
    setAuth = server.setAuth;
  });

  afterAll(async () => {
    await app.close();
  });

  describe("Get Profile Authorization", () => {
    it("as citizen it cannot see other profiles data", async () => {
      setAuth({
        userId: "userId",
        hasOnboardingPermissions: false,
        organizationId: undefined,
      });
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/profiles/another-id",
      });

      expect(response.statusCode).toBe(403);
    });

    it("as citizen it cannot ask for both private and organization details", async () => {
      setAuth({
        userId: "userId",
        hasOnboardingPermissions: false,
        organizationId: undefined,
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/profiles/userId",
        query: { organizationId: "1234", privateDetails: "true" },
      });

      expect(response.statusCode).toBe(400);
    });

    it("as public servant it cannot ask for both private and organization details", async () => {
      setAuth({
        userId: "userId",
        hasOnboardingPermissions: false,
        organizationId: "pub-ser",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/profiles/userId",
        query: { organizationId: "pub-ser", privateDetails: "true" },
      });

      expect(response.statusCode).toBe(400);
    });

    it("as public servant it cannot ask another organization details", async () => {
      setAuth({
        userId: "userId",
        hasOnboardingPermissions: false,
        organizationId: "pub-ser",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/profiles/userId",
        query: { organizationId: "another-org" },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
