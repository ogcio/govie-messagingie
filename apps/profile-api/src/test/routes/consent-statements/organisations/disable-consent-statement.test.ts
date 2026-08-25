import { randomUUID } from "node:crypto";
import { httpErrors } from "@fastify/sensible";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { insertTestConsentStatement } from "~/test/insert-test-consent-statement.js";
import { build } from "~/test/test-server-builder.js";

const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
const consentStatementSubject = "disable-consent-statement-test";

describe("PATCH - /api/v1/organisations/consent-statements/{id}/disable", async () => {
  let app: FastifyInstance = await build();

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it("Returns 403 if user does not have User Admin permissions", async () => {
    const { id } = await insertTestConsentStatement(pool, {
      subject: consentStatementSubject,
      publishDate: new Date(Date.now() + 10000),
    });

    app = await getServerWithUserPermissions();
    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/organisations/consent-statements/${id}/disable`,
    });

    expect(response.statusCode).toBe(403);
  });

  it("Returns 404 if consent statement does not exist", async () => {
    const nonExistentId = randomUUID();
    app = await getServerWithUserAdminPermissions();

    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/organisations/consent-statements/${nonExistentId}/disable`,
    });

    expect(response.statusCode).toBe(404);
  });

  it("Successfully disables a consent statement and returns 200 with updated data", async () => {
    const { id, version } = await insertTestConsentStatement(pool, {
      subject: consentStatementSubject,
      publishDate: new Date(Date.now() + 10000),
    });

    app = await getServerWithUserAdminPermissions();
    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/organisations/consent-statements/${id}/disable`,
    });

    expect(response.statusCode).toBe(200);

    const responseBody = JSON.parse(response.body);
    expect(responseBody.data).toBeDefined();

    const disabledStatement = responseBody.data;
    expect(disabledStatement.id).toBe(id);
    expect(disabledStatement.subject).toBe(consentStatementSubject);
    expect(disabledStatement.version).toBe(version);
    expect(disabledStatement.isEnabled).toBe(false);
    expect(disabledStatement.translations).toBeDefined();
    expect(disabledStatement.translations.en).toBeDefined();
    expect(disabledStatement.translations.ga).toBeDefined();

    // Verify the statement is actually disabled in the database
    const { rows } = await pool.query(
      "SELECT is_enabled FROM consent_statements WHERE id = $1",
      [id],
    );
    expect(rows.length).toBe(1);
    expect(rows[0].is_enabled).toBe(false);
  });

  it("Disabling a statement does not affect existing consents", async () => {
    const { id } = await insertTestConsentStatement(pool, {
      subject: consentStatementSubject,
      publishDate: new Date(Date.now() + 10000),
    });

    // Insert a test consent for this statement
    const testProfileId = "test12345678"; // Use a shorter ID that fits varchar(12)
    await pool.query(
      "INSERT INTO profiles (id, email, public_name, primary_user_id, safe_level) VALUES ($1, $2, $3, $4, $5)",
      [testProfileId, "test@example.com", "Test User", "user12345678", 0],
    );

    await pool.query(
      "INSERT INTO profile_consents (id, profile_id, subject, status, consent_statement_id) VALUES ($1, $2, $3, $4, $5)",
      [randomUUID(), testProfileId, consentStatementSubject, "opted-in", id],
    );

    app = await getServerWithUserAdminPermissions();
    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/organisations/consent-statements/${id}/disable`,
    });

    expect(response.statusCode).toBe(200);

    // Verify the consent still exists
    const { rows } = await pool.query(
      "SELECT COUNT(*) as count FROM profile_consents WHERE consent_statement_id = $1",
      [id],
    );
    expect(Number(rows[0].count)).toBe(1);
  });

  it("Disabling a statement preserves all original data except isEnabled", async () => {
    const { id } = await insertTestConsentStatement(pool, {
      subject: consentStatementSubject,
      publishDate: new Date(Date.now() + 10000),
    });

    // Get the original statement data
    const { rows: originalRows } = await pool.query(
      "SELECT * FROM consent_statements WHERE id = $1",
      [id],
    );
    const originalStatement = originalRows[0];

    app = await getServerWithUserAdminPermissions();
    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/organisations/consent-statements/${id}/disable`,
    });

    expect(response.statusCode).toBe(200);

    // Verify all fields except isEnabled remain the same
    const { rows: updatedRows } = await pool.query(
      "SELECT * FROM consent_statements WHERE id = $1",
      [id],
    );
    const updatedStatement = updatedRows[0];

    expect(updatedStatement.id).toBe(originalStatement.id);
    expect(updatedStatement.subject).toBe(originalStatement.subject);
    expect(updatedStatement.version).toBe(originalStatement.version);
    expect(updatedStatement.created_at).toStrictEqual(
      originalStatement.created_at,
    );
    expect(updatedStatement.publish_date).toStrictEqual(
      originalStatement.publish_date,
    );
    expect(updatedStatement.created_by).toBe(originalStatement.created_by);
    expect(updatedStatement.is_enabled).toBe(false);
    expect(originalStatement.is_enabled).toBe(true);
  });

  it("Disabling the current consent statement results in no current statement being returned", async () => {
    // Create a consent statement that is published and enabled (current)
    const { id } = await insertTestConsentStatement(pool, {
      subject: consentStatementSubject,
      publishDate: new Date(Date.now() - 1000), // Published in the past
    });

    // Verify it's the current statement before disabling
    const { rows: currentBefore } = await pool.query(
      "SELECT id FROM consent_statements WHERE subject = $1 AND publish_date <= NOW() AND is_enabled = true ORDER BY publish_date DESC LIMIT 1",
      [consentStatementSubject],
    );
    expect(currentBefore.length).toBe(1);
    expect(currentBefore[0].id).toBe(id);

    // Disable the statement
    app = await getServerWithUserAdminPermissions();
    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/organisations/consent-statements/${id}/disable`,
    });

    expect(response.statusCode).toBe(200);

    // Verify no current statement is returned after disabling
    const { rows: currentAfter } = await pool.query(
      "SELECT id FROM consent_statements WHERE subject = $1 AND publish_date <= NOW() AND is_enabled = true ORDER BY publish_date DESC LIMIT 1",
      [consentStatementSubject],
    );
    expect(currentAfter.length).toBe(0);
  });

  const getServerWithUserAdminPermissions = async () => {
    app = await build();

    app.addHook("onRequest", async (req: FastifyRequest) => {
      app.checkPermissions = async (
        request: FastifyRequest,
        _reply: FastifyReply,
        permissions: string[],
        _matchConfig?: { method: "AND" | "OR" },
      ) => {
        // Mock user admin permissions
        if (permissions.includes("profile:user.admin:write")) {
          req.userData = {
            userId: randomUUID(),
            accessToken: "accessToken",
            organizationId: "organisationId",
            isM2MApplication: false,
          };
          request.userData = req.userData;
          return;
        }

        // For other permissions, throw forbidden error to simulate 403
        throw httpErrors.forbidden("User Admin permission required");
      };
    });

    return app;
  };

  const getServerWithUserPermissions = async () => {
    app = await build();

    app.addHook("onRequest", async (req: FastifyRequest) => {
      app.checkPermissions = async (
        request: FastifyRequest,
        _reply: FastifyReply,
        permissions: string[],
        _matchConfig?: { method: "AND" | "OR" },
      ) => {
        // Mock user permissions (not admin)
        if (permissions.includes("profile:user:write")) {
          req.userData = {
            userId: randomUUID(),
            accessToken: "accessToken",
            organizationId: "organisationId",
            isM2MApplication: false,
          };
          request.userData = req.userData;
          return;
        }

        // For user admin permissions, throw forbidden error to simulate 403
        if (permissions.includes("profile:user.admin:write")) {
          throw httpErrors.forbidden("User Admin permission required");
        }
      };
    });

    return app;
  };
});
