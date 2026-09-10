import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createConsentStatement,
  disableConsentStatement,
  getAvailableConsentSubjects,
  getConsentStatementById,
  getCurrentConsentStatement,
  getCurrentConsentStatements,
  listConsentStatements,
  updateConsentStatement,
} from "~/services/consent-statements/consent-statements-service.js";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import { buildMockLogger } from "~/test/build-mock-logger.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { insertTestConsentStatement } from "~/test/insert-test-consent-statement.js";

const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
const { logger } = buildMockLogger({});
const profileId = randomUUID().substring(0, 12);

const futureDate = (offsetMs = 60 * 60 * 1000) =>
  new Date(Date.now() + offsetMs);

const buildTranslations = () => ({
  en: {
    title: "Title",
    description: "Description",
    disclaimer: "Disclaimer",
  },
  ga: {
    title: "Teideal",
    description: "Cur síos",
    disclaimer: "Séanadh",
  },
});

describe("consent-statements-service", () => {
  beforeAll(async () => {
    const client = await pool.connect();
    await createProfile(client, {
      email: `${randomUUID()}@example.com`,
      publicName: "Statement Service User",
      primaryUserId: profileId,
      id: profileId,
    });
    client.release();
  });

  afterAll(async () => {
    if (!pool.ended) {
      await pool.end();
    }
  });

  describe("createConsentStatement", () => {
    it("creates a statement with translations using a pool", async () => {
      const subject = `svc-create-${randomUUID().substring(0, 8)}`;
      const created = await createConsentStatement({
        pool,
        logger,
        loggedInUserId: profileId,
        consentStatement: {
          subject,
          publishDate: futureDate().toISOString(),
          isEnabled: true,
          translations: buildTranslations(),
        },
      });

      expect(created.id).toBeDefined();
      expect(created.version).toBe(1);

      const fetched = await getConsentStatementById({ pool, id: created.id });
      expect(fetched.subject).toBe(subject);
      expect(fetched.translations.en.title).toBe("Title");
      expect(fetched.translations.ga.title).toBe("Teideal");
    });

    it("copies en translation to ga when ga is missing", async () => {
      const subject = `svc-copy-ga-${randomUUID().substring(0, 8)}`;
      const created = await createConsentStatement({
        pool,
        logger,
        loggedInUserId: null,
        consentStatement: {
          subject,
          publishDate: futureDate().toISOString(),
          isEnabled: true,
          translations: { en: buildTranslations().en },
        },
      });

      const fetched = await getConsentStatementById({ pool, id: created.id });
      expect(fetched.translations.ga.title).toBe("Title");
    });

    it("copies ga translation to en when en is missing", async () => {
      const subject = `svc-copy-en-${randomUUID().substring(0, 8)}`;
      const created = await createConsentStatement({
        pool,
        logger,
        loggedInUserId: null,
        consentStatement: {
          subject,
          publishDate: futureDate().toISOString(),
          isEnabled: true,
          translations: { ga: buildTranslations().ga },
        },
      });

      const fetched = await getConsentStatementById({ pool, id: created.id });
      expect(fetched.translations.en.title).toBe("Teideal");
    });

    it("increments the version for an existing subject", async () => {
      const subject = `svc-version-${randomUUID().substring(0, 8)}`;
      await createConsentStatement({
        pool,
        logger,
        loggedInUserId: null,
        consentStatement: {
          subject,
          publishDate: futureDate().toISOString(),
          isEnabled: true,
          translations: buildTranslations(),
        },
      });
      const second = await createConsentStatement({
        pool,
        logger,
        loggedInUserId: null,
        consentStatement: {
          subject,
          publishDate: futureDate(2 * 60 * 60 * 1000).toISOString(),
          isEnabled: true,
          translations: buildTranslations(),
        },
      });
      expect(second.version).toBe(2);
    });

    it("rejects a statement without translations", async () => {
      await expect(
        createConsentStatement({
          pool,
          logger,
          loggedInUserId: null,
          consentStatement: {
            subject: `svc-no-translations-${randomUUID().substring(0, 8)}`,
            publishDate: futureDate().toISOString(),
            isEnabled: true,
            translations: {},
          },
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("rejects a publish date in the past", async () => {
      await expect(
        createConsentStatement({
          pool,
          logger,
          loggedInUserId: null,
          consentStatement: {
            subject: `svc-past-${randomUUID().substring(0, 8)}`,
            publishDate: new Date(Date.now() - 60 * 1000).toISOString(),
            isEnabled: true,
            translations: buildTranslations(),
          },
        }),
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it("rejects a duplicate subject + publish date", async () => {
      const subject = `svc-dup-${randomUUID().substring(0, 8)}`;
      const publishDate = futureDate().toISOString();
      await createConsentStatement({
        pool,
        logger,
        loggedInUserId: null,
        consentStatement: {
          subject,
          publishDate,
          isEnabled: true,
          translations: buildTranslations(),
        },
      });
      await expect(
        createConsentStatement({
          pool,
          logger,
          loggedInUserId: null,
          consentStatement: {
            subject,
            publishDate,
            isEnabled: true,
            translations: buildTranslations(),
          },
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("works when given an explicit client", async () => {
      const subject = `svc-client-${randomUUID().substring(0, 8)}`;
      const client = await pool.connect();
      try {
        const created = await createConsentStatement({
          client,
          logger,
          loggedInUserId: null,
          consentStatement: {
            subject,
            publishDate: futureDate().toISOString(),
            isEnabled: true,
            translations: buildTranslations(),
          },
        });
        expect(created.version).toBe(1);
      } finally {
        client.release();
      }
    });
  });

  describe("updateConsentStatement", () => {
    it("updates an unpublished statement", async () => {
      const subject = `svc-update-${randomUUID().substring(0, 8)}`;
      const created = await createConsentStatement({
        pool,
        logger,
        loggedInUserId: null,
        consentStatement: {
          subject,
          publishDate: futureDate().toISOString(),
          isEnabled: true,
          translations: buildTranslations(),
        },
      });

      await updateConsentStatement({
        pool,
        logger,
        id: created.id,
        consentStatement: {
          subject,
          publishDate: futureDate(3 * 60 * 60 * 1000).toISOString(),
          isEnabled: false,
          translations: {
            en: {
              title: "Updated title",
              description: "Updated description",
              disclaimer: "Updated disclaimer",
            },
          },
        },
      });

      const fetched = await getConsentStatementById({ pool, id: created.id });
      expect(fetched.isEnabled).toBe(false);
      expect(fetched.translations.en.title).toBe("Updated title");
      // ga translation falls back to the en one on update
      expect(fetched.translations.ga.title).toBe("Updated title");
    });

    it("rejects an update without translations", async () => {
      await expect(
        updateConsentStatement({
          pool,
          logger,
          id: randomUUID(),
          consentStatement: {
            subject: "any",
            publishDate: futureDate().toISOString(),
            isEnabled: true,
            translations: {},
          },
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("rejects updating a missing statement", async () => {
      await expect(
        updateConsentStatement({
          pool,
          logger,
          id: randomUUID(),
          consentStatement: {
            subject: "missing-subject",
            publishDate: futureDate().toISOString(),
            isEnabled: true,
            translations: { en: buildTranslations().en },
          },
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("rejects updating an already published statement", async () => {
      const subject = `svc-published-${randomUUID().substring(0, 8)}`;
      const inserted = await insertTestConsentStatement(pool, {
        subject,
        publishDate: new Date(Date.now() - 60 * 60 * 1000),
      });

      await expect(
        updateConsentStatement({
          pool,
          logger,
          id: inserted.id,
          consentStatement: {
            subject,
            publishDate: futureDate().toISOString(),
            isEnabled: true,
            translations: { en: buildTranslations().en },
          },
        }),
      ).rejects.toMatchObject({ statusCode: 422 });
    });
  });

  describe("getConsentStatementById / getCurrentConsentStatement", () => {
    it("throws 404 for an unknown id", async () => {
      await expect(
        getConsentStatementById({ pool, id: randomUUID() }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("throws 404 for a subject with no published statement", async () => {
      await expect(
        getCurrentConsentStatement({
          pool,
          subject: `svc-none-${randomUUID().substring(0, 8)}`,
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("returns the current published statement for a subject", async () => {
      const subject = `svc-current-${randomUUID().substring(0, 8)}`;
      const inserted = await insertTestConsentStatement(pool, {
        subject,
        publishDate: new Date(Date.now() - 60 * 1000),
      });

      const current = await getCurrentConsentStatement({ pool, subject });
      expect(current.id).toBe(inserted.id);
      expect(current.version).toBe(inserted.version);
    });

    it("supports an explicit client", async () => {
      const subject = `svc-current-client-${randomUUID().substring(0, 8)}`;
      await insertTestConsentStatement(pool, {
        subject,
        publishDate: new Date(Date.now() - 60 * 1000),
      });
      const client = await pool.connect();
      try {
        const current = await getCurrentConsentStatement({ client, subject });
        expect(current.subject).toBe(subject);
      } finally {
        client.release();
      }
    });
  });

  describe("getCurrentConsentStatements", () => {
    it("returns an empty array for no subjects", async () => {
      const statements = await getCurrentConsentStatements({
        pool,
        subjects: [],
      });
      expect(statements).toEqual([]);
    });

    it("returns latest statements with translations per subject", async () => {
      const subjectA = `svc-multi-a-${randomUUID().substring(0, 8)}`;
      const subjectB = `svc-multi-b-${randomUUID().substring(0, 8)}`;
      await insertTestConsentStatement(pool, {
        subject: subjectA,
        publishDate: new Date(Date.now() - 60 * 1000),
      });
      await insertTestConsentStatement(pool, {
        subject: subjectB,
        publishDate: new Date(Date.now() - 60 * 1000),
      });

      const statements = await getCurrentConsentStatements({
        pool,
        subjects: [subjectA, subjectB],
      });
      expect(statements).toHaveLength(2);
      const subjects = statements.map((s) => s.subject).sort();
      expect(subjects).toEqual([subjectA, subjectB].sort());
      for (const statement of statements) {
        expect(statement.translations.en).toBeDefined();
      }
    });
  });

  describe("listConsentStatements", () => {
    it("filters by subject and paginates", async () => {
      const subject = `svc-list-${randomUUID().substring(0, 8)}`;
      await insertTestConsentStatement(pool, {
        subject,
        publishDate: futureDate(60 * 60 * 1000),
      });
      await insertTestConsentStatement(pool, {
        subject,
        publishDate: futureDate(2 * 60 * 60 * 1000),
      });

      const page = await listConsentStatements({
        pool,
        subject,
        pagination: { limit: "1", offset: "0" },
      });
      expect(page.totalCount).toBe(2);
      expect(page.data).toHaveLength(1);
    });

    it("filters by isEnabled", async () => {
      const subject = `svc-list-disabled-${randomUUID().substring(0, 8)}`;
      await insertTestConsentStatement(pool, {
        subject,
        publishDate: futureDate(),
        isEnabled: false,
      });

      const enabled = await listConsentStatements({
        pool,
        subject,
        isEnabled: true,
        pagination: { limit: "10", offset: "0" },
      });
      expect(enabled.totalCount).toBe(0);
      expect(enabled.data).toEqual([]);

      const disabled = await listConsentStatements({
        pool,
        subject,
        isEnabled: false,
        pagination: { limit: "10", offset: "0" },
      });
      expect(disabled.totalCount).toBe(1);
    });

    it("returns empty data for an unknown subject", async () => {
      const empty = await listConsentStatements({
        pool,
        subject: `svc-list-none-${randomUUID().substring(0, 8)}`,
        pagination: { limit: "10", offset: "0" },
      });
      expect(empty).toEqual({ data: [], totalCount: 0 });
    });
  });

  describe("disableConsentStatement", () => {
    it("disables an existing statement", async () => {
      const subject = `svc-disable-${randomUUID().substring(0, 8)}`;
      const inserted = await insertTestConsentStatement(pool, {
        subject,
        publishDate: futureDate(),
        isEnabled: true,
      });

      const disabled = await disableConsentStatement({
        pool,
        logger,
        id: inserted.id,
      });
      expect(disabled.isEnabled).toBe(false);
      expect(disabled.translations.en).toBeDefined();
    });

    it("throws 404 for an unknown statement", async () => {
      await expect(
        disableConsentStatement({ pool, logger, id: randomUUID() }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe("getAvailableConsentSubjects", () => {
    it("only returns subjects in the ConsentSubjects allowlist", async () => {
      // arbitrary subjects inserted by other tests must be filtered out
      const subjects = await getAvailableConsentSubjects({ pool });
      for (const subject of subjects) {
        expect(["messaging"]).toContain(subject);
      }
    });

    it("supports an explicit client", async () => {
      const client = await pool.connect();
      try {
        const subjects = await getAvailableConsentSubjects({ client });
        expect(Array.isArray(subjects)).toBe(true);
      } finally {
        client.release();
      }
    });
  });
});
