import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mockProfiles } from "~/test/fixtures/common.js";
import { build } from "~/test/test-server-builder.js";

describe("POST /api/v1/profiles/imports", () => {
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

  describe("Input validation", () => {
    it("should reject empty profiles array", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/profiles/imports",
        payload: {
          profiles: [],
        },
        headers: {
          "content-type": "application/json",
        },
      });

      expect(response.statusCode).toBe(422);
    });

    it("should reject profiles with missing required fields", async () => {
      const { lastName, email, ...invalidProfile } = mockProfiles[0];

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/profiles/imports",
        payload: {
          profiles: [invalidProfile],
        },
        headers: {
          "content-type": "application/json",
        },
      });

      expect(response.statusCode).toBe(422);
    });

    it("should reject profiles with invalid email format", async () => {
      const invalidProfile = { ...mockProfiles[0], email: "invalid-email" };

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/profiles/imports",
        payload: {
          profiles: [invalidProfile],
        },
        headers: {
          "content-type": "application/json",
        },
      });

      expect(response.statusCode).toBe(422);
    });

    it("should reject profiles with invalid date format", async () => {
      const invalidProfile = {
        ...mockProfiles[0],
        dateOfBirth: "invalid-date",
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/profiles/imports",
        payload: {
          profiles: [invalidProfile],
        },
        headers: {
          "content-type": "application/json",
        },
      });

      expect(response.statusCode).toBe(422);
    });

    it("should reject invalid file type for CSV upload", async () => {
      const form = new FormData();
      const file = new File(["test"], "test.txt", { type: "text/plain" });
      form.append("file", file);

      const boundary = "----formdata-boundary";
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/profiles/imports",
        payload: form,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
        },
      });

      expect(response.statusCode).toBe(422);
    });
  });

  describe("Valid requests", () => {
    it("should accept valid profiles array", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/profiles/imports",
        payload: {
          profiles: mockProfiles,
        },
        headers: {
          "content-type": "application/json",
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it("should accept PPSN-only profiles with import_type=ppsn-only", async () => {
      const ppsnOnlyProfiles = [
        { ppsn: "1234567T", dateOfBirth: "1940-06-24" },
        { ppsn: "7654321T" },
      ];

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/profiles/imports?importType=ppsn-only",
        payload: {
          ppsnOnlyProfiles: ppsnOnlyProfiles,
        },
        headers: {
          "content-type": "application/json",
        },
      });

      expect(response.statusCode).toBe(200);
      const result = await response.json();
      expect(result).toHaveProperty("profileImportId");
      expect(result).toHaveProperty("status");
    });

    it("should reject PPSN-only profiles without import_type=ppsn-only", async () => {
      const ppsnOnlyProfiles = [{ ppsn: "1234567T" }, { ppsn: "7654321T" }];

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/profiles/imports",
        payload: {
          profiles: ppsnOnlyProfiles,
        },
        headers: {
          "content-type": "application/json",
        },
      });

      expect(response.statusCode).toBe(422);
    });

    it("should reject PPSN-only profiles with missing PPSN", async () => {
      const ppsnOnlyProfiles = [
        { ppsn: "1234567T" },
        { ppsn: "" }, // Empty PPSN
      ];

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/profiles/imports?importType=ppsn-only",
        payload: {
          profiles: ppsnOnlyProfiles,
        },
        headers: {
          "content-type": "application/json",
        },
      });

      expect(response.statusCode).toBe(422);
    });
  });
});
