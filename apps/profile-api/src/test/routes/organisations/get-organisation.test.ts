import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import en from "~/services/organisations/en.json" with { type: "json" };
import ga from "~/services/organisations/ga.json" with { type: "json" };
import { buildOnce } from "~/test/test-server-builder.js";

const availableTranslations = {
  en,
  ga,
};

describe("GET - /api/v1/organisations/:id", async () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const server = await buildOnce();
    app = server.app;
    server.setAuth({
      userId: "user-id",
      organizationId: "organisationId",
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("Returns 404 if organisation not found", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/organisations/${randomUUID().substring(0, 12)}`,
    });

    expect(response.statusCode).toBe(404);
  });

  it("EN: Returns expected values for each organisation", async () => {
    for (const [orgId, translations] of Object.entries(
      availableTranslations.en,
    )) {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/organisations/${orgId}`,
      });

      expect(
        response.statusCode,
        `Expected 200 for organisation ${orgId}`,
      ).toBe(200);
      const body = JSON.parse(response.body) as {
        data: {
          id: string;
          translations: {
            en: { name: string; shortName: string };
            ga: { name: string; shortName: string };
          };
        };
      };
      expect(body.data.id).toBe(orgId);
      expect(body.data.translations.en).toEqual(translations);
      expect(body.data.translations.ga).toEqual(
        availableTranslations.ga[
          orgId as keyof typeof availableTranslations.ga
        ],
      );
    }
  });

  // We also test starting by GA to check if GA has the same structure and same orgs
  // E.g. If GA would have one more organisation than EN, we need to catch that
  it("GA: Returns expected values for each organisation", async () => {
    for (const [orgId, translations] of Object.entries(
      availableTranslations.ga,
    )) {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/organisations/${orgId}`,
      });

      expect(
        response.statusCode,
        `Expected 200 for organisation ${orgId}`,
      ).toBe(200);
      const body = JSON.parse(response.body) as {
        data: {
          id: string;
          translations: {
            en: { name: string; shortName: string };
            ga: { name: string; shortName: string };
          };
        };
      };
      expect(body.data.id).toBe(orgId);
      expect(body.data.translations.ga).toEqual(translations);
      expect(body.data.translations.en).toEqual(
        availableTranslations.en[
          orgId as keyof typeof availableTranslations.ga
        ],
      );
    }
  });
});
