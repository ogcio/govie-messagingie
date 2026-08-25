import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { insertTestConsentStatement } from "~/test/insert-test-consent-statement.js";
import { buildOnce, type MockAuthConfig } from "~/test/test-server-builder.js";

const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
const consentStatementSubject = "update-consent-statement-test";

describe("PUT - /api/v1/organisations/consent-statements/{id}", async () => {
  let app: FastifyInstance;
  let setAuth: (config: MockAuthConfig) => void;

  beforeAll(async () => {
    const server = await buildOnce();
    app = server.app;
    setAuth = server.setAuth;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it("Returns 400 if body is missing required fields", async () => {
    const { id } = await insertTestConsentStatement(pool, {
      subject: consentStatementSubject,
      publishDate: new Date(Date.now() + 10000),
    });

    setAuth({ userId: "test-user-id", organizationId: "organisationId" });
    const response = await app.inject({
      method: "PUT",
      url: `/api/v1/organisations/consent-statements/${id}`,
      payload: {},
    });

    expect(response.statusCode).toBe(422);
  });

  it("Returns 422 if translations are missing required languages - missing GA", async () => {
    const { id } = await insertTestConsentStatement(pool, {
      subject: consentStatementSubject,
      publishDate: new Date(Date.now() + 25432),
    });

    setAuth({ userId: "test-user-id", organizationId: "organisationId" });
    const fullBody = getMockUpdateBody();
    const withoutGa = {
      ...fullBody,
      translations: { ...(fullBody.translations as object), ga: undefined },
    };

    const response = await app.inject({
      method: "PUT",
      url: `/api/v1/organisations/consent-statements/${id}`,
      payload: withoutGa,
    });

    expect(response.statusCode).toBe(422);
  });

  it("Returns 422 if translations are missing required languages - missing EN", async () => {
    const { id } = await insertTestConsentStatement(pool, {
      subject: consentStatementSubject,
      publishDate: new Date(Date.now() + 25432),
    });

    setAuth({ userId: "test-user-id", organizationId: "organisationId" });
    const fullBody = getMockUpdateBody();
    const withoutEn = {
      ...fullBody,
      translations: { ...(fullBody.translations as object), en: undefined },
    };

    const response = await app.inject({
      method: "PUT",
      url: `/api/v1/organisations/consent-statements/${id}`,
      payload: withoutEn,
    });

    expect(response.statusCode).toBe(422);
  });

  it("Returns 422 if statement has already been published", async () => {
    const { id } = await insertTestConsentStatement(pool, {
      subject: consentStatementSubject,
      publishDate: new Date(Date.now() - 1000),
    });
    setAuth({ userId: "test-user-id", organizationId: "organisationId" });
    const fullBody = getMockUpdateBody();

    const response = await app.inject({
      method: "PUT",
      url: `/api/v1/organisations/consent-statements/${id}`,
      payload: fullBody,
    });

    expect(response.statusCode).toBe(422);
  });

  it("Returns 422 if updated publish date is in the past", async () => {
    const { id } = await insertTestConsentStatement(pool, {
      subject: consentStatementSubject,
      publishDate: new Date(Date.now() + 50000),
    });

    setAuth({ userId: "test-user-id", organizationId: "organisationId" });
    const fullBody = getMockUpdateBody();

    fullBody.publishDate = new Date(Date.now() - 10000);

    const response = await app.inject({
      method: "PUT",
      url: `/api/v1/organisations/consent-statements/${id}`,
      payload: fullBody,
    });

    expect(response.statusCode).toBe(422);
  });

  it("Returns 404 if consent statement does not exist", async () => {
    setAuth({ userId: "test-user-id", organizationId: "organisationId" });
    const fullBody = getMockUpdateBody();

    fullBody.publishDate = new Date(Date.now() - 10000);

    const response = await app.inject({
      method: "PUT",
      url: `/api/v1/organisations/consent-statements/${randomUUID()}`,
      payload: fullBody,
    });

    expect(response.statusCode).toBe(404);
  });

  it("Returns 409 if another statement has the same publish date", async () => {
    const alreadyExistentDateForSameSubject = new Date(Date.now() + 10000);
    await insertTestConsentStatement(pool, {
      subject: consentStatementSubject,
      publishDate: alreadyExistentDateForSameSubject,
    });

    const { id: toUpdatedId } = await insertTestConsentStatement(pool, {
      subject: consentStatementSubject,
      publishDate: new Date(Date.now() + 20000),
    });
    setAuth({ userId: "test-user-id", organizationId: "organisationId" });
    const fullBody = getMockUpdateBody();
    fullBody.publishDate = alreadyExistentDateForSameSubject;

    const response = await app.inject({
      method: "PUT",
      url: `/api/v1/organisations/consent-statements/${toUpdatedId}`,
      payload: fullBody,
    });

    expect(response.statusCode).toBe(409);
  });

  it("Correctly updates updatable fields and ignores others", async () => {
    const { id: toUpdatedId, version } = await insertTestConsentStatement(
      pool,
      {
        subject: consentStatementSubject,
        publishDate: new Date(Date.now() + 98765),
      },
    );

    setAuth({ userId: "test-user-id", organizationId: "organisationId" });
    const fullBody = getMockUpdateBody();
    fullBody.isEnabled = "false";
    fullBody.subject = randomUUID().substring(0, 20);
    // should be ignored
    fullBody.createdAt = new Date();
    fullBody.createdBy = randomUUID();
    fullBody.created_at = new Date();
    fullBody.created_by = randomUUID();
    fullBody.version = 999;
    fullBody.id = randomUUID();

    const response = await app.inject({
      method: "PUT",
      url: `/api/v1/organisations/consent-statements/${toUpdatedId}`,
      payload: fullBody,
    });

    if (response.statusCode !== 200) {
      console.error(
        "Correctly updates updatable fields and ignores others:",
        JSON.parse(response.payload),
      );
    }

    expect(response.statusCode).toBe(200);
    const { rows } = await pool.query<{
      createdBy: string;
      subject: string;
      version: number;
      createdAt: Date;
      publishDate: Date;
      isEnabled: boolean;
    }>(
      `SELECT
        cs.subject,
        cs.version,
        cs.created_at as "createdAt",
        cs.publish_date as "publishDate",
        cs.is_enabled as "isEnabled",
        cs.created_by as "createdBy"
      FROM consent_statements cs
      WHERE cs.id = $1`,
      [toUpdatedId],
    );

    expect(rows.length).toBe(1);
    const updatedStatement = rows[0];
    expect(updatedStatement.subject).toBe(fullBody.subject);
    expect(updatedStatement.isEnabled).toBe(fullBody.isEnabled === "true");
    expect(updatedStatement.publishDate).toStrictEqual(fullBody.publishDate);

    // must remain the same
    expect(updatedStatement.createdBy).toBeNull();
    expect(updatedStatement.createdAt).not.toStrictEqual(fullBody.createdAt);
    expect(updatedStatement.version).toBe(version);

    const { rows: enRows } = await pool.query(
      `
      SELECT
        cst.id,
        cst.consent_statement_id as "consentStatementId",
        cst.language,
        cst.description,
        cst.disclaimer,
        cst.title,
        cst.created_at as "createdAt"
      FROM consent_statement_translations cst
      WHERE cst.consent_statement_id = $1 AND cst.language = 'en'
      `,
      [toUpdatedId],
    );
    const inputTranslations = fullBody.translations as {
      en: Record<string, string>;
      ga: Record<string, string>;
    };
    expect(enRows.length).toBe(1);
    expect(enRows[0].description).toBe(inputTranslations.en.description);
    expect(enRows[0].disclaimer).toBe(inputTranslations.en.disclaimer);
    expect(enRows[0].title).toBe(inputTranslations.en.title);

    const { rows: gaRows } = await pool.query(
      `
      SELECT
        cst.id,
        cst.consent_statement_id as "consentStatementId",
        cst.language,
        cst.description,
        cst.disclaimer,
        cst.title,
        cst.created_at as "createdAt"
      FROM consent_statement_translations cst
      WHERE cst.consent_statement_id = $1 AND cst.language = 'ga'
      `,
      [toUpdatedId],
    );
    expect(gaRows.length).toBe(1);
    expect(gaRows[0].description).toBe(inputTranslations.ga.description);
    expect(gaRows[0].disclaimer).toBe(inputTranslations.ga.disclaimer);
    expect(gaRows[0].title).toBe(inputTranslations.ga.title);
  });

  const getMockUpdateBody = (): Record<
    string,
    | string
    | number
    | Date
    | { en: Record<string, string>; ga: Record<string, string> }
  > => ({
    subject: consentStatementSubject,
    publishDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Ensure at least 24 hours in the future
    isEnabled: "true",
    translations: {
      en: {
        disclaimer: `Disclaimer ${randomUUID()}`,
        description: `Description ${randomUUID()}`,
        title: `Title ${randomUUID()}`,
      },
      ga: {
        disclaimer: `Disclaimer GA ${randomUUID()}`,
        description: `Description GA ${randomUUID()}`,
        title: `Title GA ${randomUUID()}`,
      },
    },
  });
});
