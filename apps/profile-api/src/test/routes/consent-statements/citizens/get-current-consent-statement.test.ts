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

const CONSENT_STATEMENT_SUBJECT = "test-consent-statement-cit";
let validStatementId: string | undefined;

describe("GET - /api/v1/citizens/consent-statements/current", async () => {
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

  it("Returns 422 if subject is not set as query param", async () => {
    setAuth({ userId: "test-user-id", organizationId: "organisationId" });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/citizens/consent-statements/current",
    });

    expect(response.statusCode).toBe(422);
    const body = JSON.parse(response.body);
    expect(body.detail).toContain("'subject'");
  });

  it("Returns empty body if no consent statement exists for the subject", async () => {
    setAuth({ userId: "test-user-id", organizationId: "organisationId" });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/citizens/consent-statements/current",
      query: { subject: CONSENT_STATEMENT_SUBJECT },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as {
      data: ConsentStatementWithTranslations[];
    };
    expect(body.data).toBeDefined();
    expect(body.data.length).toBe(0);
  });

  it("Returns latest consent statement with translations", async () => {
    const {
      id: statementId,
      version,
      translations,
    } = await insertTestConsentStatement(pool, {
      subject: CONSENT_STATEMENT_SUBJECT,
      publishDate: new Date(Date.now() - 1000),
    });

    setAuth({ userId: "test-user-id", organizationId: "organisationId" });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/citizens/consent-statements/current",
      query: { subject: CONSENT_STATEMENT_SUBJECT },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as {
      data: ConsentStatementWithTranslations[];
    };
    expect(body.data).toBeDefined();
    expect(body.data.length).toBe(1);
    expect(body.data[0].id).toBe(statementId);
    expect(body.data[0].subject).toBe(CONSENT_STATEMENT_SUBJECT);
    expect(body.data[0].version).toBe(version);
    expect(body.data[0].translations).toBeDefined();
    expect(body.data[0].translations.en).toBeDefined();
    expect(body.data[0].translations.ga).toBeDefined();
    expect(body.data[0].translations.en.id).toBe(translations.en.id);
    expect(body.data[0].translations.en.title).toBe(translations.en.title);
    expect(body.data[0].translations.en.description).toBe(
      translations.en.description,
    );
    expect(body.data[0].translations.en.disclaimer).toBe(
      translations.en.disclaimer,
    );
    expect(body.data[0].translations.ga.id).toBe(translations.ga.id);
    expect(body.data[0].translations.ga.title).toBe(translations.ga.title);
    expect(body.data[0].translations.ga.description).toBe(
      translations.ga.description,
    );
    expect(body.data[0].translations.ga.disclaimer).toBe(
      translations.ga.disclaimer,
    );
  });

  it("Returns current version when multiple versions exist", async () => {
    const subject = CONSENT_STATEMENT_SUBJECT;
    const latestValidFrom = new Date(Date.now() - 1000);
    // Insert older version
    const { version } = await insertTestConsentStatement(pool, {
      subject: CONSENT_STATEMENT_SUBJECT,
      publishDate: new Date(Date.now() - 2000),
    });
    // Current
    const validVersion = version + 1;
    const { id } = await insertTestConsentStatement(pool, {
      subject: CONSENT_STATEMENT_SUBJECT,
      publishDate: latestValidFrom,
      version: validVersion,
    });
    validStatementId = id;
    // in the future
    await insertTestConsentStatement(pool, {
      subject: CONSENT_STATEMENT_SUBJECT,
      publishDate: new Date(Date.now() + 10000),
      version: validVersion + 1,
    });

    setAuth({ userId: "test-user-id", organizationId: "organisationId" });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/citizens/consent-statements/current",
      query: { subject },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as {
      data: ConsentStatementWithTranslations[];
    };
    expect(body.data.length).toBe(1);
    expect(body.data[0].id).toBe(validStatementId);
    expect(body.data[0].version).toBe(validVersion);
    expect(body.data[0].publishDate).toBeDefined();
    expect(body.data[0].publishDate).toStrictEqual(
      latestValidFrom.toISOString(),
    );
    expect(body.data[0].isEnabled).toBeTruthy();
  });

  it("Returns current version for multiple subjects", async () => {
    const anotherSubject = "multiple-subject-citizen";
    const anotherStatementId = randomUUID();
    await insertTestConsentStatement(pool, {
      subject: anotherSubject,
      publishDate: new Date(Date.now() - 2000),
      statementId: anotherStatementId,
      version: 1,
    });

    setAuth({ userId: "test-user-id", organizationId: "organisationId" });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/citizens/consent-statements/current",
      query: { subject: [anotherSubject, CONSENT_STATEMENT_SUBJECT].join(",") },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as {
      data: ConsentStatementWithTranslations[];
    };
    expect(body.data.length).toBe(2);
    const responseIds = body.data.map((item) => item.id);
    const responseSubjects = body.data.map((item) => item.subject);
    expect(responseIds).toContain(anotherStatementId);
    expect(responseIds).toContain(validStatementId);
    expect(responseSubjects).toContain(anotherSubject);
    expect(responseSubjects).toContain(CONSENT_STATEMENT_SUBJECT);
  });

  it("Returns current version for subject when other one does not exist", async () => {
    const anotherSubject = "multiple-subject-citizen-not-exist";

    setAuth({ userId: "test-user-id", organizationId: "organisationId" });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/citizens/consent-statements/current",
      query: { subject: [anotherSubject, CONSENT_STATEMENT_SUBJECT].join(",") },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as {
      data: ConsentStatementWithTranslations[];
    };
    expect(body.data.length).toBe(1);
    const responseIds = body.data.map((item) => item.id);
    const responseSubjects = body.data.map((item) => item.subject);
    expect(responseIds).toContain(validStatementId);
    expect(responseSubjects).toContain(CONSENT_STATEMENT_SUBJECT);
  });

  it("Returns current version ignoring the latest if disabled", async () => {
    const subject = CONSENT_STATEMENT_SUBJECT;
    await insertTestConsentStatement(pool, {
      subject,
      publishDate: new Date(Date.now() - 100),
      isEnabled: false,
    });

    setAuth({ userId: "test-user-id", organizationId: "organisationId" });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/citizens/consent-statements/current",
      query: { subject },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as {
      data: ConsentStatementWithTranslations[];
    };
    expect(body.data.length).toBe(1);
    expect(body.data[0].id).toBe(validStatementId);
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
