import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { afterEach, describe, expect, it, suite } from "vitest";
import { build } from "../test-server-builder.js";

describe("/api/v1/templates", {}, () => {
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

  suite("create template schema validations", () => {
    it("with null contents should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/templates",
        body: {
          contents: null,
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe("body/contents must be array");
    });

    it("without contents should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/templates",
        body: {},
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe("body must have required property 'contents'");
    });

    it("with null contents[].templateName should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/templates",
        body: {
          contents: [
            {
              templateName: null,
              language: "en",
              subject: "subject",
              excerpt: "excerpt",
              plainText: "plain text",
              richText: "rich text",
            },
          ],
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe("body/contents/0/templateName must be string");
    });

    it("without contents[].templateName should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/templates",
        body: {
          contents: [
            {
              language: "en",
              subject: "subject",
              excerpt: "excerpt",
              plainText: "plain text",
              richText: "rich text",
            },
          ],
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe(
        "body/contents/0 must have required property 'templateName'",
      );
    });

    it("with null contents[].language should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/templates",
        body: {
          contents: [
            {
              templateName: "name",
              language: null,
              subject: "subject",
              excerpt: "excerpt",
              plainText: "plain text",
              richText: "rich text",
            },
          ],
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe("body/contents/0/language must be string");
    });

    it("without contents[].language should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/templates",
        body: {
          contents: [
            {
              templateName: "name",
              subject: "subject",
              excerpt: "excerpt",
              plainText: "plain text",
              richText: "rich text",
            },
          ],
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe(
        "body/contents/0 must have required property 'language'",
      );
    });

    it("with illegal contents[].language should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/templates",
        body: {
          contents: [
            {
              templateName: "name",
              language: "sv",
              subject: "subject",
              excerpt: "excerpt",
              plainText: "plain text",
              richText: "rich text",
            },
          ],
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe(
        "body/contents/0/language must be equal to one of the allowed values",
      );
    });

    it("with null contents[].subject should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/templates",
        body: {
          contents: [
            {
              templateName: "name",
              language: "en",
              subject: null,
              excerpt: "excerpt",
              plainText: "plain text",
              richText: "rich text",
            },
          ],
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe("body/contents/0/subject must be string");
    });

    it("without contents[].subject should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/templates",
        body: {
          contents: [
            {
              templateName: "name",
              language: "en",
              excerpt: "excerpt",
              plainText: "plain text",
              richText: "rich text",
            },
          ],
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe(
        "body/contents/0 must have required property 'subject'",
      );
    });

    it("with empty contents[].subject should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/templates",
        body: {
          contents: [
            {
              templateName: "name",
              language: "en",
              subject: "",
              excerpt: "excerpt",
              plainText: "plain text",
              richText: "rich text",
            },
          ],
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe(
        "body/contents/0/subject must NOT have fewer than 1 characters",
      );
    });

    it("without contents[].plainText should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/templates",
        body: {
          contents: [
            {
              templateName: "name",
              language: "en",
              subject: "subject",
              excerpt: "excerpt",
              richText: "rich text",
            },
          ],
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe(
        "body/contents/0 must have required property 'plainText'",
      );
    });

    it("with empty contents[].plainText should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/templates",
        body: {
          contents: [
            {
              templateName: "name",
              language: "en",
              subject: "subject",
              excerpt: "excerpt",
              plainText: "",
              richText: "rich text",
            },
          ],
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe(
        "body/contents/0/plainText must NOT have fewer than 1 characters",
      );
    });

    // variables
    it("with null variables should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/templates",
        body: {
          contents: [
            {
              templateName: "name",
              language: "en",
              subject: "subject",
              excerpt: "excerpt",
              plainText: "plain text",
              richText: "rich text",
            },
          ],
          variables: null,
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe("body/variables must be array");
    });

    it("without variables[].name should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/templates",
        body: {
          contents: [
            {
              templateName: "name",
              language: "en",
              subject: "subject",
              excerpt: "excerpt",
              plainText: "plain text",
              richText: "rich text",
            },
          ],
          variables: [{}],
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe(
        "body/variables/0 must have required property 'name'",
      );
    });

    it("with null variables[].name should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/templates",
        body: {
          contents: [
            {
              templateName: "name",
              language: "en",
              subject: "subject",
              excerpt: "excerpt",
              plainText: "plain text",
              richText: "rich text",
            },
          ],
          variables: [{ name: null }],
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe("body/variables/0/name must be string");
    });
  });

  suite("update template schema validations", () => {
    it("with illegal url param id should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/templates/123",
        body: {},
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe('params/templateId must match format "uuid"');
    });

    it("without body id should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/templates/ca3b108f-7b9a-487e-b40a-eb535e6056ca",
        body: {
          contents: null,
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe("body must have required property 'id'");
    });

    it("with null contents should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/templates/ca3b108f-7b9a-487e-b40a-eb535e6056ca",
        body: {
          id: "ca3b108f-7b9a-487e-b40a-eb535e6056ca",
          contents: null,
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe("body/contents must be array");
    });

    it("without contents should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/templates/ca3b108f-7b9a-487e-b40a-eb535e6056ca",
        body: {
          id: "ca3b108f-7b9a-487e-b40a-eb535e6056ca",
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe("body must have required property 'contents'");
    });

    it("with null contents[].templateName should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/templates/ca3b108f-7b9a-487e-b40a-eb535e6056ca",
        body: {
          id: "ca3b108f-7b9a-487e-b40a-eb535e6056ca",
          contents: [
            {
              templateName: null,
              language: "en",
              subject: "subject",
              excerpt: "excerpt",
              plainText: "plain text",
              richText: "rich text",
            },
          ],
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe("body/contents/0/templateName must be string");
    });

    it("without contents[].templateName should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/templates/ca3b108f-7b9a-487e-b40a-eb535e6056ca",
        body: {
          id: "ca3b108f-7b9a-487e-b40a-eb535e6056ca",
          contents: [
            {
              language: "en",
              subject: "subject",
              excerpt: "excerpt",
              plainText: "plain text",
              richText: "rich text",
            },
          ],
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe(
        "body/contents/0 must have required property 'templateName'",
      );
    });

    it("with null contents[].language should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/templates/ca3b108f-7b9a-487e-b40a-eb535e6056ca",
        body: {
          id: "ca3b108f-7b9a-487e-b40a-eb535e6056ca",
          contents: [
            {
              templateName: "name",
              language: null,
              subject: "subject",
              excerpt: "excerpt",
              plainText: "plain text",
              richText: "rich text",
            },
          ],
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe("body/contents/0/language must be string");
    });

    it("without contents[].language should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/templates/ca3b108f-7b9a-487e-b40a-eb535e6056ca",
        body: {
          id: "ca3b108f-7b9a-487e-b40a-eb535e6056ca",
          contents: [
            {
              templateName: "name",
              subject: "subject",
              excerpt: "excerpt",
              plainText: "plain text",
              richText: "rich text",
            },
          ],
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe(
        "body/contents/0 must have required property 'language'",
      );
    });

    it("with illegal contents[].language should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/templates/ca3b108f-7b9a-487e-b40a-eb535e6056ca",
        body: {
          id: "ca3b108f-7b9a-487e-b40a-eb535e6056ca",
          contents: [
            {
              templateName: "name",
              language: "sv",
              subject: "subject",
              excerpt: "excerpt",
              plainText: "plain text",
              richText: "rich text",
            },
          ],
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe(
        "body/contents/0/language must be equal to one of the allowed values",
      );
    });

    it("with null contents[].subject should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/templates/ca3b108f-7b9a-487e-b40a-eb535e6056ca",
        body: {
          id: "ca3b108f-7b9a-487e-b40a-eb535e6056ca",
          contents: [
            {
              templateName: "name",
              language: "en",
              subject: null,
              excerpt: "excerpt",
              plainText: "plain text",
              richText: "rich text",
            },
          ],
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe("body/contents/0/subject must be string");
    });

    it("with null contents[].excerpt should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/templates/ca3b108f-7b9a-487e-b40a-eb535e6056ca",
        body: {
          id: "ca3b108f-7b9a-487e-b40a-eb535e6056ca",
          contents: [
            {
              templateName: "name",
              language: "en",
              subject: "subject",
              excerpt: null,
              plainText: "plain text",
              richText: "rich text",
            },
          ],
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe("body/contents/0/excerpt must be string");
    });

    it("with null contents[].plainText should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/templates/ca3b108f-7b9a-487e-b40a-eb535e6056ca",
        body: {
          id: "ca3b108f-7b9a-487e-b40a-eb535e6056ca",
          contents: [
            {
              templateName: "name",
              language: "en",
              subject: "subject",
              excerpt: "excerpt",
              plainText: null,
              richText: "rich text",
            },
          ],
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe("body/contents/0/plainText must be string");
    });

    it("with null contents[].richText should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/templates/ca3b108f-7b9a-487e-b40a-eb535e6056ca",
        body: {
          id: "ca3b108f-7b9a-487e-b40a-eb535e6056ca",
          contents: [
            {
              templateName: "name",
              language: "en",
              subject: "subject",
              excerpt: "excerpt",
              plainText: "plain text",
              richText: null,
            },
          ],
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe("body/contents/0/richText must be string");
    });

    it("with empty variables should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/templates/ca3b108f-7b9a-487e-b40a-eb535e6056ca",
        body: {
          id: "ca3b108f-7b9a-487e-b40a-eb535e6056ca",
          contents: [
            {
              templateName: "name",
              language: "en",
              subject: "subject",
              excerpt: "excerpt",
              plainText: "plain text",
              richText: "rich text",
            },
          ],
          variables: [],
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe(
        "body/variables must NOT have fewer than 1 items",
      );
    });

    it("with null variables[].name should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/templates/ca3b108f-7b9a-487e-b40a-eb535e6056ca",
        body: {
          id: "ca3b108f-7b9a-487e-b40a-eb535e6056ca",
          contents: [
            {
              templateName: "name",
              language: "en",
              subject: "subject",
              excerpt: "excerpt",
              plainText: "plain text",
              richText: "rich text",
            },
          ],
          variables: [{ name: null }],
        },
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe("body/variables/0/name must be string");
    });
  });

  suite("delete template schema validations", () => {
    it("with illegal url param id should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "DELETE",
        url: "/api/v1/templates/123",
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe('params/templateId must match format "uuid"');
    });
  });

  suite("get one template schema validations", () => {
    it("with illegal url param id should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/templates/123",
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe('params/templateId must match format "uuid"');
    });
  });

  suite("get many templates schema validations", () => {
    it("with illegal limit query params should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/templates?limit=-10",
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe(
        'querystring/limit must match pattern "^([1-9]|100)|undefined$"',
      );
    });

    it("with illegal offset query params should fail", async () => {
      app = await getServer();
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/templates?offset=-10",
      });
      const body = await res.json();

      expect(res.statusCode).toBe(422);
      expect(body.code).toBe("VALIDATION_ERROR");
      expect(body.detail).toBe(
        'querystring/offset must match pattern "^[0-9][0-9]*|undefined$"',
      );
    });
  });
});
