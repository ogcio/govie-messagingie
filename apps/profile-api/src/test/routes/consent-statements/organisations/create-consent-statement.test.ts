import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { CreateConsentStatement } from "~/schemas/consent-statements/organisation.js";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { buildOnce, type MockAuthConfig } from "~/test/test-server-builder.js";

const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
const CONSENT_STATEMENT_SUBJECT = "create-consent-statement-test";
describe("POST - /api/v1/organisations/consent-statements", async () => {
  let app: FastifyInstance;
  let setAuth: (config: MockAuthConfig) => void;
  const profileId: string = randomUUID().substring(0, 12);

  beforeAll(async () => {
    const server = await buildOnce();
    app = server.app;
    setAuth = server.setAuth;

    const client = await pool.connect();
    // Need to create profile because of the created_by constraint in
    // consent_statement table
    await createProfile(client, {
      email: `${randomUUID()}@example.com`,
      publicName: "User",
      primaryUserId: profileId,
      id: profileId,
    });
    client.release();
  });

  beforeEach(async () => {
    const deleteCsQuery = "FROM consent_statements where subject = $1";
    await pool.query(
      `DELETE FROM consent_statement_translations 
        WHERE consent_statement_id in (SELECT id ${deleteCsQuery})`,
      [CONSENT_STATEMENT_SUBJECT],
    );
    await pool.query(`DELETE ${deleteCsQuery}`, [CONSENT_STATEMENT_SUBJECT]);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it("Returns 400 if body is missing required fields", async () => {
    setAuth({ userId: profileId, organizationId: "organisationId" });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/organisations/consent-statements",
      payload: {},
    });

    expect(response.statusCode).toBe(422);
  });

  it("Returns 400 if translations are missing required languages", async () => {
    setAuth({ userId: profileId, organizationId: "organisationId" });
    const fullBody: CreateConsentStatement = {
      subject: CONSENT_STATEMENT_SUBJECT,
      publishDate: new Date(Date.now() - 1000).toISOString(),
      isEnabled: "true",
      translations: {
        en: {
          disclaimer: "Disclaimer",
          description: "Description",
          title: "Title",
        },
        ga: {
          disclaimer: "Disclaimer GA",
          description: "Description GA",
          title: "Title GA",
        },
      },
    };
    const withoutGa = {
      ...fullBody,
      translations: { ...fullBody.translations, ga: undefined },
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/organisations/consent-statements",
      payload: withoutGa,
    });

    expect(response.statusCode).toBe(422);
  });

  it("Creates consent statement with translations successfully", async () => {
    setAuth({ userId: profileId, organizationId: "organisationId" });
    const fullBody: CreateConsentStatement = {
      subject: CONSENT_STATEMENT_SUBJECT,
      publishDate: new Date(
        Date.now() + 24 * 60 * 60 * 1000, // Ensure at least 24 hours in the future
      ).toISOString(),
      isEnabled: "true",
      translations: {
        en: {
          disclaimer: "Disclaimer",
          description: "Description",
          title: "Title",
        },
        ga: {
          disclaimer: "Disclaimer GA",
          description: "Description GA",
          title: "Title GA",
        },
      },
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/organisations/consent-statements",
      payload: fullBody,
    });
    if (response.statusCode !== 200) {
      console.error(
        "Creates consent statement with translations successfully:",
        JSON.parse(response.body),
      );
    }
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.id).toBeDefined();

    // Verify consent statement was created
    const { rows: statements } = await pool.query(
      "SELECT * FROM consent_statements WHERE id = $1",
      [body.data.id],
    );
    expect(statements).toHaveLength(1);
    expect(statements[0].subject).toBe(fullBody.subject);
    expect(statements[0].version).toBeTypeOf("number");
    expect(statements[0].created_by).toBe(profileId);

    // Verify translations were created
    const { rows: translations } = await pool.query(
      "SELECT * FROM consent_statement_translations WHERE consent_statement_id = $1",
      [body.data.id],
    );
    expect(translations).toHaveLength(2);
    expect(translations.map((t) => t.language)).toContain("en");
    expect(translations.map((t) => t.language)).toContain("ga");
  });

  it("Returns 422 if publishDate is in the past", async () => {
    setAuth({ userId: profileId, organizationId: "organisationId" });
    const fullBody: CreateConsentStatement = {
      subject: CONSENT_STATEMENT_SUBJECT,
      publishDate: new Date(
        Date.now() - 24 * 60 * 60 * 1000, // Ensure at least 24 hours in the past
      ).toISOString(),
      isEnabled: "true",
      translations: {
        en: {
          disclaimer: "Disclaimer",
          description: "Description",
          title: "Title",
        },
        ga: {
          disclaimer: "Disclaimer GA",
          description: "Description GA",
          title: "Title GA",
        },
      },
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/organisations/consent-statements",
      payload: fullBody,
    });

    expect(response.statusCode).toBe(422);
  });

  it("Creates consent statement for M2M", async () => {
    setAuth({
      userId: "a-string-longer-than-12-char",
      isM2MApplication: true,
      organizationId: "organisationId",
    });
    const fullBody: CreateConsentStatement = {
      subject: CONSENT_STATEMENT_SUBJECT,
      publishDate: new Date(Date.now() + 24 * 60 * 60 * 2000).toISOString(),
      isEnabled: "true",
      translations: {
        en: {
          disclaimer: "Disclaimer",
          description: "Description",
          title: "Title",
        },
        ga: {
          disclaimer: "Disclaimer GA",
          description: "Description GA",
          title: "Title GA",
        },
      },
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/organisations/consent-statements",
      payload: fullBody,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.id).toBeDefined();

    // Verify consent statement was created
    const { rows: statements } = await pool.query(
      "SELECT * FROM consent_statements WHERE id = $1",
      [body.data.id],
    );
    expect(statements).toHaveLength(1);
    expect(statements[0].subject).toBe(fullBody.subject);
    expect(statements[0].created_by).toBeNull();
  });
});
