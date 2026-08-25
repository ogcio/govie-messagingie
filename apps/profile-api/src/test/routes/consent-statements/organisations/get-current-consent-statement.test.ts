import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ConsentStatementWithTranslations } from "~/schemas/consent-statements/shared.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import {
  insertTestConsentStatement,
  type TestStatementTranslations,
} from "~/test/insert-test-consent-statement.js";
import { buildOnce, type MockAuthConfig } from "~/test/test-server-builder.js";

const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);

const CONSENT_STATEMENT_SUBJECT = "test-consent-statement-org";

describe("GET - /api/v1/organisations/consent-statements/current", async () => {
  let app: FastifyInstance;
  let setAuth: (config: MockAuthConfig) => void;
  let latestConsentStatementVersion = 1;
  const validStatementId = randomUUID();

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

  it("Returns 422 if subject is not set as query param", async () => {
    setAuth({ userId: "test-user-id", organizationId: "organisationId" });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/organisations/consent-statements/current",
    });

    expect(response.statusCode).toBe(422);
    const body = JSON.parse(response.body);
    expect(body.detail).toContain("'subject'");
  });

  it("Returns empty array if no consent statement exists for the subject", async () => {
    setAuth({ userId: "test-user-id", organizationId: "organisationId" });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/organisations/consent-statements/current",
      query: { subject: CONSENT_STATEMENT_SUBJECT },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBeDefined();
    const body = JSON.parse(response.body);
    expect(body.data).toBeDefined();
    expect(body.data.length).toBe(0);
  });

  it("Returns current consent statement with translations", async () => {
    const subject = CONSENT_STATEMENT_SUBJECT;
    const version = latestConsentStatementVersion++;
    const statementId = randomUUID();
    const latestValidFrom = new Date(Date.now() - 500);
    const { translations } = await insertTestConsentStatement(pool, {
      statementId,
      subject,
      version,
      publishDate: latestValidFrom,
    });

    setAuth({ userId: "test-user-id", organizationId: "organisationId" });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/organisations/consent-statements/current",
      query: { subject },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.length).toBe(1);
    expect(body.data).toBeDefined();
    expect(body.data[0].id).toBe(statementId);
    expect(body.data[0].subject).toBe(subject);
    expect(body.data[0].version).toBe(version);
    expect(body.data[0].publishDate).toStrictEqual(
      latestValidFrom.toISOString(),
    );
    expect(body.data[0].translations).toBeDefined();
    expect(body.data[0].translations.en).toBeDefined();
    expect(body.data[0].translations.ga).toBeDefined();
    expect(body.data[0].translations.en.id).toBe(translations.en.id);
    expect(body.data[0].translations.ga.id).toBe(translations.ga.id);
  });

  it("Returns current version when multiple versions exist", async () => {
    const subject = "multiple-version-exists-ps";
    let latestVersion = latestConsentStatementVersion++;

    // Insert older version
    await insertTestConsentStatement(pool, {
      subject,
      version: latestVersion++,
      publishDate: new Date(Date.now() - 2000),
    });

    await insertTestConsentStatement(pool, {
      subject,
      statementId: validStatementId,
      version: latestVersion,
      publishDate: new Date(Date.now() - 999),
    });

    setAuth({ userId: "test-user-id", organizationId: "organisationId" });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/organisations/consent-statements/current",
      query: { subject },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toBeDefined();
    expect(body.data.length).toBe(1);
    expect(body.data[0].id).toBe(validStatementId);
    expect(body.data[0].version).toBe(latestVersion);
  });

  it("Returns current version for multiple subjects", async () => {
    const firstSubject = "first-subject-ps";
    const firstSubjectStatementId = randomUUID();
    await insertTestConsentStatement(pool, {
      subject: firstSubject,
      statementId: firstSubjectStatementId,
      version: latestConsentStatementVersion++,
      publishDate: new Date(Date.now() - 999),
    });
    // Insert another subject
    const anotherSubject = "multiple-subject-ps";
    const anotherStatementId = randomUUID();
    await insertTestConsentStatement(pool, {
      subject: anotherSubject,
      statementId: anotherStatementId,
      version: 1,
      publishDate: new Date(Date.now() - 2000),
    });

    setAuth({ userId: "test-user-id", organizationId: "organisationId" });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/organisations/consent-statements/current",
      query: { subject: [anotherSubject, firstSubject].join(",") },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as {
      data: ConsentStatementWithTranslations[];
    };
    expect(body.data.length).toBe(2);
    const responseIds = body.data.map((item) => item.id);
    const responseSubjects = body.data.map((item) => item.subject);
    expect(responseIds).toContain(anotherStatementId);
    expect(responseIds).toContain(firstSubjectStatementId);
    expect(responseSubjects).toContain(anotherSubject);
    expect(responseSubjects).toContain(firstSubject);
  });

  it("Returns current version for subject when other one does not exist", async () => {
    const anotherSubject = "multiple-subject-ps-not-exist";

    setAuth({ userId: "test-user-id", organizationId: "organisationId" });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/organisations/consent-statements/current",
      query: {
        subject: [anotherSubject, CONSENT_STATEMENT_SUBJECT].join(","),
      },
    });
    if (response.statusCode !== 200) {
      console.error(
        "Returns current version for subject when other one does not exist:",
        JSON.parse(response.body),
      );
    }

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as {
      data: ConsentStatementWithTranslations[];
    };
    expect(body.data.length).toBe(1);
    const responseSubjects = body.data.map((item) => item.subject);
    expect(responseSubjects).toContain(CONSENT_STATEMENT_SUBJECT);
  });

  it("Returns current version ignoring the latest if disabled", async () => {
    const firstSubject = "ignore-disabled-ps";
    const firstSubjectStatementId = randomUUID();
    await insertTestConsentStatement(pool, {
      subject: firstSubject,
      statementId: firstSubjectStatementId,
      version: latestConsentStatementVersion++,
      publishDate: new Date(Date.now() - 999),
    });

    await insertTestConsentStatement(pool, {
      subject: firstSubject,
      statementId: randomUUID(),
      version: latestConsentStatementVersion++,
      publishDate: new Date(Date.now() - 100),
      isEnabled: false,
    });

    setAuth({ userId: "test-user-id", organizationId: "organisationId" });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/organisations/consent-statements/current",
      query: { subject: firstSubject },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as {
      data: ConsentStatementWithTranslations[];
    };
    expect(body.data.length).toBe(1);
    expect(body.data[0].id).toBe(firstSubjectStatementId);
  });

  it("Returns current version for multiple subjects when multiple versions for them exist", async () => {
    const subjects = [
      randomUUID().substring(0, 8),
      randomUUID().substring(0, 8),
      randomUUID().substring(0, 8),
    ];
    // first one will be created as disabled
    // then, even if it's newer than the second one,
    // the second one will be the current one
    const datesForEachSubject = [
      Date.now() - 400,
      Date.now() - 500,
      Date.now() - 1000,
      Date.now() - 1500,
      Date.now() + 2000,
    ];
    const currentStatementIds = [];
    const currentTranslations: Record<string, TestStatementTranslations> = {};

    for (const subject of subjects) {
      for (
        let dateIndex = 0;
        dateIndex < datesForEachSubject.length;
        dateIndex++
      ) {
        const statementId = randomUUID();
        const { translations } = await insertTestConsentStatement(pool, {
          subject,
          publishDate: new Date(datesForEachSubject[dateIndex]),
          statementId,
          version: dateIndex + 1,
          isEnabled: dateIndex !== 0,
        });
        if (dateIndex === 1) {
          currentStatementIds.push(statementId);
          currentTranslations[statementId] = translations;
        }
      }
    }

    setAuth({ userId: "test-user-id", organizationId: "organisationId" });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/citizens/consent-statements/current",
      query: { subject: subjects.join(",") },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as {
      data: ConsentStatementWithTranslations[];
    };
    expect(body.data.length).toBe(3);
    const responseIds = body.data.map((item) => item.id).sort();
    expect(responseIds).toStrictEqual(currentStatementIds.sort());

    for (const itemInBody of body.data) {
      expect(itemInBody.translations.en.id).toStrictEqual(
        currentTranslations[itemInBody.id].en.id,
      );
      expect(itemInBody.translations.ga.id).toStrictEqual(
        currentTranslations[itemInBody.id].ga.id,
      );
    }
  });
});
