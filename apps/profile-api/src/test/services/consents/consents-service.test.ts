import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import {
  CascadeConsentReasons,
  ConsentStatuses,
} from "~/schemas/consents/shared.js";
import {
  getConsentsForUser,
  getLatestConsentForUser,
  getLatestConsentForUsers,
  submitConsent,
  submitConsents,
  submitSupportConsents,
} from "~/services/consents/consents-service.js";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import { buildMockLogger } from "~/test/build-mock-logger.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { insertTestConsentStatement } from "~/test/insert-test-consent-statement.js";

const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
const { logger } = buildMockLogger({});

const createTestProfile = async () => {
  const id = randomUUID().substring(0, 12);
  const client = await pool.connect();
  try {
    await createProfile(client, {
      id,
      primaryUserId: id,
      publicName: `User ${id}`,
      email: `${id}@example.com`,
    });
  } finally {
    client.release();
  }
  return id;
};

const insertProfileDetails = async (
  profileId: string,
  organisationId: string,
) => {
  await pool.query(
    `INSERT INTO profile_details (id, profile_id, organisation_id, is_latest)
     VALUES ($1, $2, $3, true)`,
    [randomUUID(), profileId, organisationId],
  );
};

const publishedStatement = (subject: string) =>
  insertTestConsentStatement(pool, {
    subject,
    publishDate: new Date(Date.now() - 60 * 1000),
  });

describe("consents-service", () => {
  afterAll(async () => {
    if (!pool.ended) {
      await pool.end();
    }
  });

  describe("submitConsent + getConsentsForUser + getLatestConsentForUser", () => {
    it("submits and reads back a consent", async () => {
      const profileId = await createTestProfile();
      const subject = `consent-svc-${randomUUID().substring(0, 8)}`;
      const statement = await publishedStatement(subject);

      const submitted = await submitConsent({
        pool,
        logger,
        userId: profileId,
        reason: CascadeConsentReasons.ExplicitSubmission,
        consentInput: {
          subject,
          status: ConsentStatuses.OptedIn,
          consentStatementId: statement.id,
        },
      });
      expect(submitted.id).toBeDefined();

      const page = await getConsentsForUser({
        pool,
        userId: profileId,
        subject,
        paginationParams: { limit: "10", offset: "0" },
      });
      expect(page.totalCount).toBe(1);
      expect(page.data[0].status).toBe(ConsentStatuses.OptedIn);
      expect(Number(page.data[0].consentStatement?.version)).toBe(
        statement.version,
      );

      const latest = await getLatestConsentForUser({
        pool,
        userId: profileId,
        subject,
      });
      expect(latest.consentStatementId).toBe(statement.id);
    });

    it("returns empty data for a user without consents", async () => {
      const page = await getConsentsForUser({
        pool,
        userId: randomUUID().substring(0, 12),
        subject: "messaging",
        paginationParams: { limit: "10", offset: "0" },
      });
      expect(page).toEqual({ data: [], totalCount: 0 });
    });

    it("throws 404 for getLatestConsentForUser without consents", async () => {
      await expect(
        getLatestConsentForUser({
          pool,
          userId: randomUUID().substring(0, 12),
          subject: "messaging",
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("returns an array (possibly empty) when passing subjects", async () => {
      const consents = await getLatestConsentForUser({
        pool,
        userId: randomUUID().substring(0, 12),
        subjects: ["messaging"],
      });
      expect(consents).toEqual([]);
    });

    it("rejects submitting a consent with a non-current statement", async () => {
      const profileId = await createTestProfile();
      const subject = `consent-old-${randomUUID().substring(0, 8)}`;
      await publishedStatement(subject);

      await expect(
        submitConsent({
          pool,
          logger,
          userId: profileId,
          reason: CascadeConsentReasons.ExplicitSubmission,
          consentInput: {
            subject,
            status: ConsentStatuses.OptedIn,
            consentStatementId: randomUUID(),
          },
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe("submitConsents (citizen flow)", () => {
    it("submits valid consents for a primary profile", async () => {
      const profileId = await createTestProfile();
      const subject = `consents-multi-${randomUUID().substring(0, 8)}`;
      const statement = await publishedStatement(subject);

      const response = await submitConsents({
        pool,
        logger,
        userId: profileId,
        consentInput: {
          consents: [
            {
              subject,
              status: ConsentStatuses.OptedIn,
              consentStatementId: statement.id,
            },
          ],
        },
      });

      expect(response.data).toHaveLength(1);
      expect(response.data[0].subject).toBe(subject);
      expect(response.data[0].statementVersion).toBe(statement.version);
    });

    it("returns validation errors for a non-current statement", async () => {
      const profileId = await createTestProfile();
      const subject = `consents-invalid-${randomUUID().substring(0, 8)}`;
      await publishedStatement(subject);

      const response = await submitConsents({
        pool,
        logger,
        userId: profileId,
        consentInput: {
          consents: [
            {
              subject,
              status: ConsentStatuses.OptedIn,
              consentStatementId: randomUUID(),
            },
          ],
        },
      });
      expect(response.data).toEqual([]);
      expect(response.errors).toHaveLength(1);
      expect(response.errors?.[0].errors[0]).toContain(
        "not the current active statement",
      );
    });

    it("returns validation errors for an unknown subject", async () => {
      const profileId = await createTestProfile();
      const subject = `consents-none-${randomUUID().substring(0, 8)}`;

      const response = await submitConsents({
        pool,
        logger,
        userId: profileId,
        consentInput: {
          consents: [
            {
              subject,
              status: ConsentStatuses.OptedIn,
              consentStatementId: randomUUID(),
            },
          ],
        },
      });
      expect(response.data).toEqual([]);
      expect(response.errors?.[0].errors[0]).toContain(
        "No current active statement",
      );
    });

    it("returns validation errors for an invalid status transition", async () => {
      const profileId = await createTestProfile();
      const subject = `consents-transition-${randomUUID().substring(0, 8)}`;
      const statement = await publishedStatement(subject);

      await submitConsents({
        pool,
        logger,
        userId: profileId,
        consentInput: {
          consents: [
            {
              subject,
              status: ConsentStatuses.OptedIn,
              consentStatementId: statement.id,
            },
          ],
        },
      });

      // opted-in -> pending is not a valid transition
      const response = await submitConsents({
        pool,
        logger,
        userId: profileId,
        consentInput: {
          consents: [
            {
              subject,
              status: ConsentStatuses.Pending,
              consentStatementId: statement.id,
            },
          ],
        },
      });
      expect(response.data).toEqual([]);
      expect(response.errors?.[0].errors[0]).toContain(
        "Invalid status transition",
      );
    });
  });

  describe("submitSupportConsents", () => {
    it("resolves statement ids from current statements", async () => {
      const profileId = await createTestProfile();
      const subject = `support-consents-${randomUUID().substring(0, 8)}`;
      const statement = await publishedStatement(subject);

      const response = await submitSupportConsents({
        pool,
        logger,
        userId: profileId,
        consentInput: {
          consents: [{ subject, status: ConsentStatuses.OptedOut }],
        },
      });

      expect(response.data).toHaveLength(1);
      expect(response.data[0].consentStatementId).toBe(statement.id);
      expect(response.data[0].status).toBe(ConsentStatuses.OptedOut);
    });

    it("rejects subjects with no active statement", async () => {
      const profileId = await createTestProfile();

      await expect(
        submitSupportConsents({
          pool,
          logger,
          userId: profileId,
          consentInput: {
            consents: [
              {
                subject: `support-none-${randomUUID().substring(0, 8)}`,
                status: ConsentStatuses.OptedIn,
              },
            ],
          },
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe("getLatestConsentForUsers", () => {
    it("returns latest consents for an organisation", async () => {
      const organisationId = `org-${randomUUID().substring(0, 8)}`;
      const subject = `org-consents-${randomUUID().substring(0, 8)}`;
      const statement = await publishedStatement(subject);

      const profileId = await createTestProfile();
      await insertProfileDetails(profileId, organisationId);
      await submitConsent({
        pool,
        logger,
        userId: profileId,
        reason: CascadeConsentReasons.ExplicitSubmission,
        consentInput: {
          subject,
          status: ConsentStatuses.OptedIn,
          consentStatementId: statement.id,
        },
      });

      const page = await getLatestConsentForUsers({
        pool,
        subject,
        organisationId,
        paginationParams: { limit: "10", offset: "0" },
      });
      expect(page.totalCount).toBe(1);
      expect(page.data[0].profileId).toBe(profileId);
    });

    it("returns empty result for an organisation without consents", async () => {
      const page = await getLatestConsentForUsers({
        pool,
        subject: "messaging",
        organisationId: `org-none-${randomUUID().substring(0, 8)}`,
        paginationParams: { limit: "10", offset: "0" },
      });
      expect(page).toEqual({ data: [], totalCount: 0 });
    });
  });
});
