import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createConsentStatement,
  disableConsentStatement,
  getCurrentConsentStatements,
  listConsentStatements,
  updateConsentStatement,
} from "~/services/consent-statements/consent-statements-service.js";
import { buildMockLogger } from "~/test/build-mock-logger.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { insertTestConsentStatement } from "~/test/insert-test-consent-statement.js";

const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
const { logger } = buildMockLogger({});

const futureDate = (offsetMs = 60 * 60 * 1000) =>
  new Date(Date.now() + offsetMs);

type Translations = Parameters<
  typeof createConsentStatement
>[0]["consentStatement"]["translations"];

const enOnlyTranslations = () =>
  ({
    en: {
      title: "Only English",
      description: "Description",
      disclaimer: "Disclaimer",
    },
  }) as Translations;

const gaOnlyTranslations = () =>
  ({
    ga: {
      title: "Gaeilge amháin",
      description: "Cur síos",
      disclaimer: "Séanadh",
    },
  }) as Translations;

// Exercise the explicit-client variants of every entry point: they run outside
// withClient/withRollback and are otherwise only reached from other services.
describe("consent-statements-service with an explicit client", () => {
  let client: PoolClient;

  beforeEach(async () => {
    client = await pool.connect();
  });

  afterEach(() => {
    client?.release();
  });

  afterAll(async () => {
    if (!pool.ended) {
      await pool.end();
    }
  });

  it("creates a statement via client, copying en -> ga translations", async () => {
    const subject = `svc-cli-create-${randomUUID().substring(0, 8)}`;

    const created = await createConsentStatement({
      client,
      logger,
      loggedInUserId: null,
      consentStatement: {
        subject,
        publishDate: futureDate().toISOString(),
        isEnabled: true,
        translations: enOnlyTranslations(),
      },
    });

    expect(created.version).toBe(1);
  });

  it("updates a statement via client, copying ga -> en translations", async () => {
    const subject = `svc-cli-update-${randomUUID().substring(0, 8)}`;
    const created = await createConsentStatement({
      client,
      logger,
      loggedInUserId: null,
      consentStatement: {
        subject,
        publishDate: futureDate().toISOString(),
        isEnabled: true,
        translations: enOnlyTranslations(),
      },
    });

    await updateConsentStatement({
      client,
      logger,
      id: created.id,
      consentStatement: {
        subject,
        publishDate: futureDate(2 * 60 * 60 * 1000).toISOString(),
        isEnabled: true,
        translations: gaOnlyTranslations(),
      },
    });
  });

  it("lists statements via client with the isEnabled filter", async () => {
    const subject = `svc-cli-list-${randomUUID().substring(0, 8)}`;
    await insertTestConsentStatement(pool, {
      subject,
      publishDate: futureDate(),
    });

    const page = await listConsentStatements({
      client,
      subject,
      isEnabled: true,
      pagination: { limit: "10", offset: "0" },
    });

    expect(page.totalCount).toBe(1);
  });

  it("returns [] from getCurrentConsentStatements for no subjects and unknown subjects", async () => {
    await expect(
      getCurrentConsentStatements({ client, subjects: [] }),
    ).resolves.toEqual([]);
    await expect(
      getCurrentConsentStatements({
        client,
        subjects: [`svc-cli-none-${randomUUID().substring(0, 8)}`],
      }),
    ).resolves.toEqual([]);
  });

  it("returns current statements per subject via client", async () => {
    const subject = `svc-cli-current-${randomUUID().substring(0, 8)}`;
    const inserted = await insertTestConsentStatement(pool, {
      subject,
      publishDate: new Date(Date.now() - 60_000),
    });

    const statements = await getCurrentConsentStatements({
      client,
      subjects: [subject],
    });

    expect(statements).toHaveLength(1);
    expect(statements[0].id).toBe(inserted.id);
    expect(statements[0].translations.en).toBeDefined();
  });

  it("disables a statement via client", async () => {
    const subject = `svc-cli-disable-${randomUUID().substring(0, 8)}`;
    const inserted = await insertTestConsentStatement(pool, {
      subject,
      publishDate: futureDate(),
    });

    const disabled = await disableConsentStatement({
      client,
      logger,
      id: inserted.id,
    });

    expect(disabled.isEnabled).toBe(false);
  });
});
