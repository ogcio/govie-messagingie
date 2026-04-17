import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Record } from "typebox";
import { beforeAll, describe, expect, it } from "vitest";
import { build } from "../test-server-builder.js";

describe("/api/v1/providers", {}, () => {
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

  let app: FastifyInstance;

  beforeAll(async () => {
    app = await getServer();
  });

  const getMockProvider = (): Record<
    string,
    string | number | null | boolean | Record<string, string>
  > => ({
    id: randomUUID(),
    type: "email",
    isPrimary: false,
    smtpHost: "host",
    smtpPort: 12345,
    username: "update user",
    password: "update password",
    providerName: randomUUID().substring(0, 10),
    fromAddress: `${randomUUID().substring(0, 10)}@example.com`,
    ssl: false,
    headers: null,
  });

  describe("create", async () => {
    it("should fail when no type is provided", async () => {
      const inputBody = getMockProvider();
      delete inputBody.type;

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/providers",
        body: inputBody,
      });

      const body = await res.json();
      expect(res.statusCode).toBe(422);
      expect(
        body.validation.find(
          (v: Record<string, string>) => v.fieldName === "type",
        )?.message,
      ).toBe("must have required property 'type'");
    });

    it("should fail when invalid type is provided", async () => {
      const inputBody = getMockProvider();
      inputBody.type = "fail";

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/providers",
        body: inputBody,
      });

      const body = await res.json();
      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(
        body.validation.find(
          (v: Record<string, string>) => v.fieldName === "type",
        )?.message,
      ).toBe("must be equal to one of the allowed values");
    });

    it("should fail with empty providerName", async () => {
      const inputBody = getMockProvider();
      inputBody.providerName = "";

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/providers",
        body: inputBody,
      });

      const body = await res.json();
      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(
        body.validation.find(
          (v: Record<string, string>) => v.fieldName === "providerName",
        )?.message,
      ).toBe("must NOT have fewer than 1 characters");
    });

    it("should fail with null providerName", async () => {
      const inputBody = getMockProvider();
      inputBody.providerName = null;

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/providers",
        body: inputBody,
      });

      const body = await res.json();
      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(
        body.validation.find(
          (v: Record<string, string>) => v.fieldName === "providerName",
        )?.message,
      ).toBe("must be string");
    });

    it("should fail with empty fromAddress", async () => {
      const inputBody = getMockProvider();
      inputBody.fromAddress = "";

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/providers",
        body: inputBody,
      });

      const body = await res.json();
      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(
        body.validation.find(
          (v: Record<string, string>) => v.fieldName === "fromAddress",
        )?.message,
      ).toBe("must NOT have fewer than 1 characters");
    });

    it("should fail with empty password", async () => {
      const inputBody = getMockProvider();
      inputBody.password = "";

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/providers",
        body: inputBody,
      });

      const body = await res.json();
      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(
        body.validation.find(
          (v: Record<string, string>) => v.fieldName === "password",
        )?.message,
      ).toBe("must NOT have fewer than 1 characters");
    });

    it("should fail with null username", async () => {
      const inputBody = getMockProvider();
      inputBody.username = null;

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/providers",
        body: inputBody,
      });

      const body = await res.json();
      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(
        body.validation.find(
          (v: Record<string, string>) => v.fieldName === "username",
        )?.message,
      ).toBe("must be string");
    });

    it("should fail with non-numeric smtpPort", async () => {
      const inputBody = getMockProvider();
      inputBody.smtpPort = "";

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/providers",
        body: inputBody,
      });

      const body = await res.json();
      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(
        body.validation.find(
          (v: Record<string, string>) => v.fieldName === "smtpPort",
        )?.message,
      ).toBe("must be number");
    });

    it("should fail with null smtpPort", async () => {
      const inputBody = getMockProvider();
      inputBody.smtpPort = null;

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/providers",
        body: inputBody,
      });

      const body = await res.json();
      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(
        body.validation.find(
          (v: Record<string, string>) => v.fieldName === "smtpPort",
        )?.message,
      ).toBe("must be number");
    });

    it("null smtpHost should fail", async () => {
      const inputBody = getMockProvider();
      inputBody.smtpHost = null;
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/providers",
        body: inputBody,
      });

      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(
        body.validation.find(
          (v: { fieldName: string }) => v.fieldName === "smtpHost",
        )?.message,
      ).toBe("must be string");
    });

    it("string ssl should fail", async () => {
      const inputBody = getMockProvider();
      inputBody.ssl = "fail";

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/providers",
        body: inputBody,
      });

      const body = await res.json();
      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(
        body.validation.find(
          (v: { fieldName: string }) => v.fieldName === "ssl",
        )?.message,
      ).toBe("must be boolean");
    });

    it("no ssl should fail", async () => {
      const inputBody = getMockProvider();
      delete inputBody.ssl;
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/providers",
        body: inputBody,
      });

      const body = await res.json();
      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(
        body.validation.find(
          (v: { fieldName: string }) => v.fieldName === "ssl",
        )?.message,
      ).toBe("must have required property 'ssl'");
    });

    it("string isPrimary should fail", async () => {
      const inputBody = getMockProvider();
      inputBody.isPrimary = "fail";

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/providers",
        body: inputBody,
      });

      const body = await res.json();
      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(
        body.validation.find(
          (v: { fieldName: string }) => v.fieldName === "isPrimary",
        )?.message,
      ).toBe("must be boolean");
    });

    it("no isPrimary should fail", async () => {
      const inputBody = getMockProvider();
      delete inputBody.isPrimary;
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/providers",
        body: inputBody,
      });

      const body = await res.json();
      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(
        body.validation.find(
          (v: { fieldName: string }) => v.fieldName === "isPrimary",
        )?.message,
      ).toBe("must have required property 'isPrimary'");
    });

    it("no headers should work", async () => {
      const inputBody = getMockProvider();
      delete inputBody.headers;

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/providers",
        body: inputBody,
      });

      expect(res.statusCode).toBe(201);
    });
  });

  describe("update", async () => {
    it("should fail when id in url parameter mismatch with body id", async () => {
      const inputBody = getMockProvider();

      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/providers/${randomUUID()}`,
        body: inputBody,
      });

      const body = await res.json();
      expect(res.statusCode).toBe(400);
      expect(body.detail).toBe(
        "provider id from body and url param are not identical",
      );
    });

    it("providing no type should fail", async () => {
      const inputBody = getMockProvider();
      delete inputBody.type;
      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/providers/${inputBody.id}`,
        body: inputBody,
      });

      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(
        body.validation.find(
          (v: { fieldName: string }) => v.fieldName === "type",
        )?.message,
      ).toBe("must have required property 'type'");
    });

    it("providing invalid type should fail", async () => {
      const inputBody = getMockProvider();
      inputBody.type = "fail";

      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/providers/${inputBody.id}`,
        body: inputBody,
      });

      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(
        body.validation.find(
          (v: { fieldName: string }) => v.fieldName === "type",
        )?.message,
      ).toBe("must be equal to one of the allowed values");
    });

    it("non uuid id in url parameter should fail", async () => {
      const inputBody = getMockProvider();
      inputBody.id = "123";

      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/providers/123",
        body: inputBody,
      });

      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(
        body.validation.find(
          (v: { fieldName: string }) => v.fieldName === "providerId",
        )?.message,
      ).toBe('must match format "uuid"');
    });

    it("null fromAddress should fail", async () => {
      const inputBody = getMockProvider();
      inputBody.fromAddress = null;

      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/providers/${inputBody.id}`,
        body: inputBody,
      });

      const body = await res.json();
      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(
        body.validation.find(
          (v: { fieldName: string }) => v.fieldName === "fromAddress",
        )?.message,
      ).toBe("must be string");
    });

    it("null username should fail", async () => {
      const inputBody = getMockProvider();
      inputBody.username = null;

      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/providers/${inputBody.id}`,
        body: inputBody,
      });

      const body = await res.json();
      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(
        body.validation.find(
          (v: { fieldName: string }) => v.fieldName === "username",
        )?.message,
      ).toBe("must be string");
    });

    it("null smtpPort should fail", async () => {
      const inputBody = getMockProvider();
      inputBody.smtpPort = null;

      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/providers/${inputBody.id}`,
        body: inputBody,
      });

      const body = await res.json();
      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(
        body.validation.find(
          (v: { fieldName: string }) => v.fieldName === "smtpPort",
        )?.message,
      ).toBe("must be number");
    });

    it("null smtpHost should fail", async () => {
      const inputBody = getMockProvider();
      inputBody.smtpHost = null;

      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/providers/${inputBody.id}`,
        body: inputBody,
      });

      const body = await res.json();
      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(
        body.validation.find(
          (v: { fieldName: string }) => v.fieldName === "smtpHost",
        )?.message,
      ).toBe("must be string");
    });

    it("no smtpHost should fail", async () => {
      const inputBody = getMockProvider();
      delete inputBody.smtpHost;

      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/providers/${inputBody.id}`,
        body: inputBody,
      });

      const body = await res.json();
      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(
        body.validation.find(
          (v: { fieldName: string }) => v.fieldName === "smtpHost",
        )?.message,
      ).toBe("must have required property 'smtpHost'");
    });

    it("string ssl should fail", async () => {
      const inputBody = getMockProvider();
      inputBody.ssl = "fail";

      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/providers/${inputBody.id}`,
        body: inputBody,
      });

      const body = await res.json();
      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(
        body.validation.find(
          (v: { fieldName: string }) => v.fieldName === "ssl",
        )?.message,
      ).toBe("must be boolean");
    });

    it("no ssl should fail", async () => {
      const inputBody = getMockProvider();
      delete inputBody.ssl;

      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/providers/${inputBody.id}`,
        body: inputBody,
      });
      const body = await res.json();
      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(
        body.validation.find(
          (v: { fieldName: string }) => v.fieldName === "ssl",
        )?.message,
      ).toBe("must have required property 'ssl'");
    });

    it("string isPrimary should fail", async () => {
      const inputBody = getMockProvider();
      inputBody.isPrimary = "fail";

      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/providers/${inputBody.id}`,
        body: inputBody,
      });

      const body = await res.json();
      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(
        body.validation.find(
          (v: { fieldName: string }) => v.fieldName === "isPrimary",
        )?.message,
      ).toBe("must be boolean");
    });

    it("no isPrimary should fail", async () => {
      const inputBody = getMockProvider();
      delete inputBody.isPrimary;

      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/providers/${inputBody.id}`,
        body: inputBody,
      });

      const body = await res.json();
      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(
        body.validation.find(
          (v: { fieldName: string }) => v.fieldName === "isPrimary",
        )?.message,
      ).toBe("must have required property 'isPrimary'");
    });

    it("no password should work", async () => {
      // Create one first
      const inputBody = getMockProvider();
      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/providers",
        body: inputBody,
      });

      expect(createRes.statusCode).toBe(201);

      const body = JSON.parse(createRes.body);
      inputBody.id = body.data.id;
      delete inputBody.password;

      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/providers/${inputBody.id}`,
        body: inputBody,
      });

      expect(res.statusCode).toBe(200);
    });

    it("null password should work", async () => {
      // Create one first
      const inputBody = getMockProvider();
      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/providers",
        body: inputBody,
      });
      expect(createRes.statusCode).toBe(201);

      const body = JSON.parse(createRes.body);
      inputBody.id = body.data.id;
      inputBody.password = null;

      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/providers/${inputBody.id}`,
        body: inputBody,
      });

      expect(res.statusCode).toBe(200);
    });

    it("empty password should work", async () => {
      // Create one first
      const inputBody = getMockProvider();
      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/providers",
        body: inputBody,
      });
      expect(createRes.statusCode).toBe(201);

      const body = JSON.parse(createRes.body);
      inputBody.id = body.data.id;
      inputBody.password = "";

      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/providers/${inputBody.id}`,
        body: inputBody,
      });

      expect(res.statusCode).toBe(200);
    });
  });

  describe("get one provider schema validations", async () => {
    it("non uuid id url param should fail", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/providers/fail",
      });

      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(
        body.validation.find(
          (v: { fieldName: string }) => v.fieldName === "providerId",
        )?.message,
      ).toBe('must match format "uuid"');
    });

    it("no type search query should fail", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/providers/ca3b108f-7b9a-487e-b40a-eb535e6056ca",
      });

      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(
        body.validation.find(
          (v: { fieldName: string }) => v.fieldName === "type",
        )?.message,
      ).toBe("must have required property 'type'");
    });

    it("invalid type search query should fail", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/providers/ca3b108f-7b9a-487e-b40a-eb535e6056ca?type=fail",
      });

      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(
        body.validation.find(
          (v: { fieldName: string }) => v.fieldName === "type",
        )?.message,
      ).toBe("must be equal to one of the allowed values");
    });

    it("must return the expected provider", async () => {
      // Create one first
      const inputBody = getMockProvider();
      inputBody.headers = { "X-Test-Header": "test" };

      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/providers",
        body: inputBody,
      });
      expect(createRes.statusCode).toBe(201);

      const createResponse = JSON.parse(createRes.body);

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/providers/${createResponse.data.id}?type=email`,
      });

      const body = await res.json();

      expect(res.statusCode).toBe(200);
      expect(body.data.id).toBe(createResponse.data.id);
      expect(body.data.providerName).toBe(inputBody.providerName);
      expect(body.data.fromAddress).toBe(inputBody.fromAddress);
      expect(body.data.username).toBe(inputBody.username);
      expect(body.data.smtpHost).toBe(inputBody.smtpHost);
      expect(body.data.smtpPort).toBe(inputBody.smtpPort);
      expect(body.data.ssl).toBe(inputBody.ssl);
      expect(body.data.isPrimary).toBe(inputBody.isPrimary);
      expect(body.data.type).toBe("email");
      expect(body.data.password).toBeUndefined();
      expect(body.data.headers).toEqual(inputBody.headers);
    });
  });

  describe("get many providers schema validations", async () => {
    it("no type search query should fail", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/providers",
      });

      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(
        body.validation.find(
          (v: { fieldName: string }) => v.fieldName === "type",
        )?.message,
      ).toBe("must have required property 'type'");
    });

    it("invalid type search query should fail", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/providers?type=fail",
      });

      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(
        body.validation.find(
          (v: { fieldName: string }) => v.fieldName === "type",
        )?.message,
      ).toBe("must be equal to one of the allowed values");
    });
  });

  describe("delete provider schema validations", async () => {
    it("non uuid id url param should fail", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/v1/providers/fail",
      });

      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(
        body.validation.find(
          (v: { fieldName: string }) => v.fieldName === "providerId",
        )?.message,
      ).toBe('must match format "uuid"');
    });
  });
});
