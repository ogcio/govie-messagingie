import { randomUUID } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import { beforeAll, describe, expect, it } from "vitest";
import { buildLogtoClient } from "~/clients/logto.js";
import { MY_GOV_ID_IDENTITY } from "~/const/logto.js";
import { ImportStatuses } from "~/const/profile.js";
import {
  CascadeConsentReasons,
  ConsentStatuses,
  ConsentSubjects,
} from "~/schemas/consents/shared.js";
import type { LogtoUserCreatedBody } from "~/schemas/webhooks/logto-user-created.js";
import { getCurrentConsentStatement } from "~/services/consent-statements/consent-statements-service.js";
import { WebhookConsentService } from "~/services/webhooks/consent-service.js";
import { processUserCreatedOrUpdatedWebhook } from "~/services/webhooks/process-user-created-updated-webhook.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { mockLogger, mockLogtoConfig } from "~/test/fixtures/common.js";
import { withClient } from "~/utils/with-client.js";

const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);

describe("processUserCreatedOrUpdatedWebhook", () => {
  let consentStatementId: string;

  beforeAll(async () => {
    const { id } = await getCurrentConsentStatement({
      pool,
      subject: ConsentSubjects.Messaging,
    });
    consentStatementId = id;
  });

  it("should process webhook successfully - from job", async () => {
    const userId = randomUUID().substring(0, 12);
    const email = "test@example.com";
    const profileImportId = randomUUID();
    const organizationId = randomUUID();

    // Create profile import
    await pool.query(
      `INSERT INTO profile_imports (id, organisation_id, status)
       VALUES ($1, $2, $3)`,
      [profileImportId, organizationId, ImportStatuses.PROCESSING],
    );

    // Create profile import detail
    await pool.query(
      `INSERT INTO profile_import_details (
         profile_import_id, data
       ) VALUES ($1, $2)`,
      [
        profileImportId,
        {
          email,
          firstName: "Test",
          lastName: "User",
        },
      ],
    );

    const webhookBody: LogtoUserCreatedBody = {
      event: "User.Created",
      data: {
        id: userId,
        primaryEmail: email,
        username: null,
        customData: {
          profileImportId,
          organizationId,
          insertPrivateDetails: false,
          onlyPrivateDetails: false,
        },
        identities: {},
      },
    };

    const result = await processUserCreatedOrUpdatedWebhook({
      body: webhookBody,
      pool,
      logger: mockLogger as unknown as FastifyBaseLogger,
      config: mockLogtoConfig,
      getLogtoClient: () => buildLogtoClient(mockLogtoConfig),
    });

    expect(result.status).toBe("success");
    expect(result.id).toBe(userId);
  });

  it("should process webhook successfully - from MyGovID", async () => {
    const userId = randomUUID().substring(0, 12);
    const email = "test@example.com";
    const ppsn = "1234567T";

    const webhookBody: LogtoUserCreatedBody = {
      event: "User.Created",
      data: {
        id: userId,
        primaryEmail: email,
        username: null,
        identities: {
          [MY_GOV_ID_IDENTITY]: {
            details: {
              email,
              rawData: {
                firstName: "Test",
                lastName: "User",
                PublicServiceNumber: ppsn,
                BirthDate: "1990-01-01",
              },
            },
          },
        },
        customData: {},
      },
    };

    const result = await processUserCreatedOrUpdatedWebhook({
      body: webhookBody,
      pool,
      logger: mockLogger as unknown as FastifyBaseLogger,
      config: mockLogtoConfig,
      getLogtoClient: () => buildLogtoClient(mockLogtoConfig),
    });

    if (result.status === "error") {
      console.log(
        "should process webhook successfully - from MyGovID",
        result.error,
      );
    }
    expect(result.status).toBe("success");
    expect(result.id).toBe(userId);

    // Verify profile data was created with PPSN
    const { rows: profileData } = await pool.query(
      "SELECT * FROM profile_data WHERE profile_details_id in (SELECT id from profile_details where profile_id = $1) AND name = 'ppsn'",
      [userId],
    );
    expect(profileData).toHaveLength(1);
    expect(profileData[0].value).toBe(ppsn);
  });

  it("should link interim user when logging in with matching PPSN", async () => {
    const interimUserId = randomUUID().substring(0, 12);
    const loggedInUserId = randomUUID().substring(0, 12);
    const ppsn = "1234567T";
    const email = "test@example.com";

    // Create interim user
    await pool.query(
      `INSERT INTO profiles (id, primary_user_id, email, public_name)
       VALUES ($1, $1, $2, $3)`,
      [interimUserId, "interim@example.com", "Interim Public"],
    );

    const query = `INSERT INTO profile_details(
        profile_id,
        organisation_id,
        is_latest
    ) VALUES ($1, $2, $3) RETURNING id;`;

    const values = [interimUserId, "org-id", true];

    const { rows: pdetails } = await pool.query<{ id: string }>(query, values);

    // Add PPSN to profile_data
    await pool.query(
      `INSERT INTO profile_data (id, profile_details_id, name, value, value_type)
       VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), pdetails[0].id, "ppsn", ppsn, "string"],
    );

    await pool.query(
      `INSERT INTO profile_data (id, profile_details_id, name, value, value_type)
       VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), pdetails[0].id, "external_id", ppsn, "string"],
    );

    const webhookBody: LogtoUserCreatedBody = {
      event: "User.Created",
      data: {
        id: loggedInUserId,
        primaryEmail: email,
        username: null,
        identities: {
          [MY_GOV_ID_IDENTITY]: {
            details: {
              email,
              rawData: {
                firstName: "Test",
                lastName: "User",
                PublicServiceNumber: ppsn,
              },
            },
          },
        },
        customData: {},
      },
    };

    const result = await processUserCreatedOrUpdatedWebhook({
      body: webhookBody,
      pool,
      logger: mockLogger as unknown as FastifyBaseLogger,
      config: mockLogtoConfig,
      getLogtoClient: () => buildLogtoClient(mockLogtoConfig),
    });

    expect(result.status).toBe("success");

    // Verify profile was linked
    const { rows } = await pool.query(
      "SELECT primary_user_id FROM profiles WHERE id = $1",
      [interimUserId],
    );
    expect(rows[0].primary_user_id).toBe(loggedInUserId);
  });

  it("should not link interim user when logging in with matching PPSN", async () => {
    const interimUserId = randomUUID().substring(0, 12);
    const loggedInUserId = randomUUID().substring(0, 12);
    const ppsn = "1234567T";
    const email = "test@example.com";

    // Create interim user
    await pool.query(
      `INSERT INTO profiles (id, primary_user_id, email, public_name)
       VALUES ($1, $1, $2, $3)`,
      [interimUserId, "interim@example.com", "Interim Public"],
    );

    const query = `INSERT INTO profile_details(
        profile_id,
        organisation_id,
        is_latest
    ) VALUES ($1, $2, $3) RETURNING id;`;

    // This is different from previous test
    const values = [interimUserId, null, true];

    const { rows: pdetails } = await pool.query<{ id: string }>(query, values);

    // Add PPSN to profile_data
    await pool.query(
      `INSERT INTO profile_data (id, profile_details_id, name, value, value_type)
       VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), pdetails[0].id, "ppsn", ppsn, "string"],
    );

    await pool.query(
      `INSERT INTO profile_data (id, profile_details_id, name, value, value_type)
       VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), pdetails[0].id, "external_id", ppsn, "string"],
    );

    const webhookBody: LogtoUserCreatedBody = {
      event: "User.Created",
      data: {
        id: loggedInUserId,
        primaryEmail: email,
        username: null,
        identities: {
          [MY_GOV_ID_IDENTITY]: {
            details: {
              email,
              rawData: {
                firstName: "Test",
                lastName: "User",
                PublicServiceNumber: ppsn,
              },
            },
          },
        },
        customData: {},
      },
    };

    const result = await processUserCreatedOrUpdatedWebhook({
      body: webhookBody,
      pool,
      logger: mockLogger as unknown as FastifyBaseLogger,
      config: mockLogtoConfig,
      getLogtoClient: () => buildLogtoClient(mockLogtoConfig),
    });

    expect(result.status).toBe("success");

    // Verify profile was not linked
    const { rows } = await pool.query(
      "SELECT primary_user_id FROM profiles WHERE id = $1",
      [interimUserId],
    );
    expect(rows[0].primary_user_id).toBe(interimUserId);
  });

  it("should handle errors gracefully", async () => {
    const webhookBody: LogtoUserCreatedBody = {
      event: "User.Created",
      data: {
        id: randomUUID(),
        primaryEmail: "invalid", // This will cause validation error
        username: null,
        identities: {},
        customData: {},
      },
    };

    const result = await processUserCreatedOrUpdatedWebhook({
      body: webhookBody,
      pool,
      logger: mockLogger as unknown as FastifyBaseLogger,
      config: mockLogtoConfig,
      getLogtoClient: () => buildLogtoClient(mockLogtoConfig),
    });

    expect(result.status).toBe("error");
    expect(result.error).toBeDefined();
  });

  // Consent tests
  it("should submit consent pre-approved when user is imported and didn't exist", async () => {
    const profileImportId = randomUUID();
    const userId = randomUUID().substring(0, 12);
    const email = "test@example.com";

    // Create profile import
    await pool.query(
      `INSERT INTO profile_imports (id, organisation_id, status)
       VALUES ($1, $2, $3)`,
      [profileImportId, "org-123", ImportStatuses.PROCESSING],
    );

    // Create profile import detail
    await pool.query(
      `INSERT INTO profile_import_details (
         profile_import_id, data
       ) VALUES ($1, $2)`,
      [
        profileImportId,
        {
          email,
          firstName: "Test",
          lastName: "User",
        },
      ],
    );

    const webhookBody: LogtoUserCreatedBody = {
      event: "User.Created",
      data: {
        id: userId,
        primaryEmail: email,
        username: null,
        customData: {
          profileImportId,
          organizationId: "org-123",
        },
        identities: {},
      },
    };

    const result = await processUserCreatedOrUpdatedWebhook({
      body: webhookBody,
      pool,
      logger: mockLogger as unknown as FastifyBaseLogger,
      config: mockLogtoConfig,
      getLogtoClient: () => buildLogtoClient(mockLogtoConfig),
    });

    expect(result.status).toBe("success");

    // Verify consent was created with pre-approved status
    const { rows: consents } = await pool.query(
      "SELECT * FROM profile_consents WHERE profile_id = $1 ORDER BY created_at DESC LIMIT 1",
      [userId],
    );
    expect(consents).toHaveLength(1);
    expect(consents[0].status).toBe(ConsentStatuses.PreApproved);
  });

  it("should submit consent undefined when user has direct signin and didn't exist", async () => {
    const userId = randomUUID().substring(0, 12);
    const email = "test@example.com";

    const webhookBody: LogtoUserCreatedBody = {
      event: "User.Created",
      data: {
        id: userId,
        primaryEmail: email,
        username: null,
        identities: {
          [MY_GOV_ID_IDENTITY]: {
            details: {
              email,
              rawData: {
                firstName: "Test",
                lastName: "User",
              },
            },
          },
        },
        customData: {},
      },
    };

    const result = await processUserCreatedOrUpdatedWebhook({
      body: webhookBody,
      pool,
      logger: mockLogger as unknown as FastifyBaseLogger,
      config: mockLogtoConfig,
      getLogtoClient: () => buildLogtoClient(mockLogtoConfig),
    });
    if (result.status === "error") {
      console.log(
        "should submit consent undefined when user has direct signin and didn't exist",
        result.error,
      );
    }
    expect(result.status).toBe("success");

    // Verify consent was created with undefined status
    const { rows: consents } = await pool.query(
      "SELECT * FROM profile_consents WHERE profile_id = $1 ORDER BY created_at DESC LIMIT 1",
      [userId],
    );
    expect(consents).toHaveLength(1);
    expect(consents[0].status).toBe(ConsentStatuses.Undefined);
  });

  it("should submit consent pre-approved when user is imported and latest consent is undefined", async () => {
    const existingUserId = randomUUID().substring(0, 12);
    const profileImportId = randomUUID();
    const email = "test@example.com";

    // Create existing user with undefined consent
    await pool.query(
      `INSERT INTO profiles (id, primary_user_id, email, public_name)
       VALUES ($1, $1, $2, $3)`,
      [
        existingUserId,
        email,
        `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
      ],
    );

    // Insert existing consent with undefined status
    await pool.query(
      `INSERT INTO profile_consents (profile_id, subject, status, consent_statement_id)
       VALUES ($1, $2, $3, $4)`,
      [
        existingUserId,
        ConsentSubjects.Messaging,
        ConsentStatuses.Undefined,
        consentStatementId,
      ],
    );

    // Create profile import
    await pool.query(
      `INSERT INTO profile_imports (id, organisation_id, status)
       VALUES ($1, $2, $3)`,
      [profileImportId, "org-123", ImportStatuses.PROCESSING],
    );

    await pool.query(
      `INSERT INTO profile_import_details (
         profile_import_id, data
       ) VALUES ($1, $2)`,
      [
        profileImportId,
        {
          email,
          firstName: "Test",
          lastName: "User",
        },
      ],
    );

    const webhookBody: LogtoUserCreatedBody = {
      event: "User.Created",
      data: {
        id: existingUserId,
        primaryEmail: email,
        username: null,
        customData: {
          profileImportId,
          organizationId: "org-123",
        },
        identities: {},
      },
    };

    const result = await processUserCreatedOrUpdatedWebhook({
      body: webhookBody,
      pool,
      logger: mockLogger as unknown as FastifyBaseLogger,
      config: mockLogtoConfig,
      getLogtoClient: () => buildLogtoClient(mockLogtoConfig),
    });

    expect(result.status).toBe("success");

    // Verify new consent was created with pre-approved status
    const { rows: consents } = await pool.query(
      "SELECT * FROM profile_consents WHERE profile_id = $1 ORDER BY created_at DESC LIMIT 1",
      [existingUserId],
    );
    expect(consents).toHaveLength(1);
    expect(consents[0].status).toBe(ConsentStatuses.PreApproved);
  });

  it("should not submit consent when user is imported and latest consent has non-undefined status", async () => {
    const existingUserId = randomUUID().substring(0, 12);
    const profileImportId = randomUUID();
    const email = "test@example.com";

    // Create existing user with opted-in consent
    await pool.query(
      `INSERT INTO profiles (id, primary_user_id, email, public_name)
       VALUES ($1, $1, $2, $3)`,
      [
        existingUserId,
        email,
        `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
      ],
    );

    // Insert existing consent with opted-in status
    const existingConsentId = randomUUID();
    await pool.query(
      `INSERT INTO profile_consents (id, profile_id, subject, status, consent_statement_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        existingConsentId,
        existingUserId,
        ConsentSubjects.Messaging,
        ConsentStatuses.OptedIn,
        consentStatementId,
      ],
    );

    // Create profile import
    await pool.query(
      `INSERT INTO profile_imports (id, organisation_id, status)
       VALUES ($1, $2, $3)`,
      [profileImportId, "org-123", ImportStatuses.PROCESSING],
    );

    await pool.query(
      `INSERT INTO profile_import_details (
         profile_import_id, data
       ) VALUES ($1, $2)`,
      [
        profileImportId,
        {
          email,
          firstName: "Test",
          lastName: "User",
        },
      ],
    );

    const webhookBody: LogtoUserCreatedBody = {
      event: "User.Created",
      data: {
        id: existingUserId,
        primaryEmail: email,
        username: null,
        customData: {
          profileImportId,
          organizationId: "org-123",
        },
        identities: {},
      },
    };

    const result = await processUserCreatedOrUpdatedWebhook({
      body: webhookBody,
      pool,
      logger: mockLogger as unknown as FastifyBaseLogger,
      config: mockLogtoConfig,
      getLogtoClient: () => buildLogtoClient(mockLogtoConfig),
    });

    expect(result.status).toBe("success");

    // Verify no new consent was created
    const { rows: consents } = await pool.query(
      "SELECT * FROM profile_consents WHERE profile_id = $1 ORDER BY created_at DESC",
      [existingUserId],
    );
    expect(consents).toHaveLength(1);
    expect(consents[0].id).toBe(existingConsentId);
    expect(consents[0].status).toBe(ConsentStatuses.OptedIn);
  });

  it("should submit consent undefined when user has direct signin and no previous consent", async () => {
    const existingUserId = randomUUID().substring(0, 12);
    const email = "test@example.com";

    // Create existing user without consents
    await pool.query(
      `INSERT INTO profiles (id, primary_user_id, email, public_name)
       VALUES ($1, $1, $2, $3)`,
      [
        existingUserId,
        email,
        `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
      ],
    );

    const webhookBody: LogtoUserCreatedBody = {
      event: "User.Created",
      data: {
        id: existingUserId,
        primaryEmail: email,
        username: null,
        identities: {
          [MY_GOV_ID_IDENTITY]: {
            details: {
              email,
              rawData: {
                firstName: "Test",
                lastName: "User",
              },
            },
          },
        },
        customData: {},
      },
    };

    const result = await processUserCreatedOrUpdatedWebhook({
      body: webhookBody,
      pool,
      logger: mockLogger as unknown as FastifyBaseLogger,
      config: mockLogtoConfig,
      getLogtoClient: () => buildLogtoClient(mockLogtoConfig),
    });
    if (result.status === "error") {
      console.log(
        "should submit consent undefined when user has direct signin and no previous consent",
        result.error,
      );
    }
    expect(result.status).toBe("success");

    // Verify consent was created with undefined status
    const { rows: consents } = await pool.query(
      "SELECT * FROM profile_consents WHERE profile_id = $1",
      [existingUserId],
    );
    expect(consents).toHaveLength(1);
    expect(consents[0].status).toBe(ConsentStatuses.Undefined);
  });

  it("should not submit consent when user has direct signin and latest consent has any status", async () => {
    const existingUserId = randomUUID().substring(0, 12);
    const email = "test@example.com";

    // Create existing user with opted-out consent
    await pool.query(
      `INSERT INTO profiles (id, primary_user_id, email, public_name)
       VALUES ($1, $1, $2, $3)`,
      [
        existingUserId,
        email,
        `${randomUUID().substring(0, 5)} ${randomUUID().substring(0, 5)}`,
      ],
    );

    // Insert existing consent
    const existingConsentId = randomUUID();
    await pool.query(
      `INSERT INTO profile_consents (id, profile_id, subject, status, consent_statement_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        existingConsentId,
        existingUserId,
        ConsentSubjects.Messaging,
        ConsentStatuses.OptedOut,
        consentStatementId,
      ],
    );

    const webhookBody: LogtoUserCreatedBody = {
      event: "User.Created",
      data: {
        id: existingUserId,
        primaryEmail: email,
        username: null,
        identities: {
          [MY_GOV_ID_IDENTITY]: {
            details: {
              email,
              rawData: {
                firstName: "Test",
                lastName: "User",
              },
            },
          },
        },
        customData: {},
      },
    };

    const result = await processUserCreatedOrUpdatedWebhook({
      body: webhookBody,
      pool,
      logger: mockLogger as unknown as FastifyBaseLogger,
      config: mockLogtoConfig,
      getLogtoClient: () => buildLogtoClient(mockLogtoConfig),
    });

    expect(result.status).toBe("success");

    // Verify no new consent was created
    const { rows: consents } = await pool.query(
      "SELECT * FROM profile_consents WHERE profile_id = $1",
      [existingUserId],
    );
    expect(consents).toHaveLength(1);
    expect(consents[0].id).toBe(existingConsentId);
    expect(consents[0].status).toBe(ConsentStatuses.OptedOut);
  });

  it("should cascade consent when linking interim user with matching PPSN", async () => {
    const interimUserId = randomUUID().substring(0, 12);
    const loggedInUserId = randomUUID().substring(0, 12);
    const ppsn = "1234567T";
    const email = "test@example.com";

    // Create interim user
    await pool.query(
      `INSERT INTO profiles (id, primary_user_id, email, public_name)
       VALUES ($1, $1, $2, $3)`,
      [interimUserId, "interim@example.com", "Interim Public"],
    );

    const query = `INSERT INTO profile_details(
        profile_id,
        organisation_id,
        is_latest
    ) VALUES ($1, $2, $3) RETURNING id;`;

    const values = [interimUserId, "org-id", true];

    const { rows: pdetails } = await pool.query<{ id: string }>(query, values);

    // Add PPSN to profile_data
    await pool.query(
      `INSERT INTO profile_data (id, profile_details_id, name, value, value_type)
       VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), pdetails[0].id, "ppsn", ppsn, "string"],
    );

    await pool.query(
      `INSERT INTO profile_data (id, profile_details_id, name, value, value_type)
       VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), pdetails[0].id, "external_id", ppsn, "string"],
    );

    const webhookBody: LogtoUserCreatedBody = {
      event: "User.Created",
      data: {
        id: loggedInUserId,
        primaryEmail: email,
        username: null,
        identities: {
          [MY_GOV_ID_IDENTITY]: {
            details: {
              email,
              rawData: {
                firstName: "Test",
                lastName: "User",
                PublicServiceNumber: ppsn,
              },
            },
          },
        },
        customData: {},
      },
    };

    const result = await processUserCreatedOrUpdatedWebhook({
      body: webhookBody,
      pool,
      logger: mockLogger as unknown as FastifyBaseLogger,
      config: mockLogtoConfig,
      getLogtoClient: () => buildLogtoClient(mockLogtoConfig),
    });

    expect(result.status).toBe("success");

    // Verify profile was linked
    const { rows: linkRows } = await pool.query(
      "SELECT primary_user_id FROM profiles WHERE id = $1",
      [interimUserId],
    );
    expect(linkRows[0].primary_user_id).toBe(loggedInUserId);

    // Verify consent was cascaded to both profiles
    const { rows: consentRows } = await pool.query(
      `SELECT pc.profile_id, pc.status, pc.cascade_reason, pc.cascade_source_profile_id, pc.created_at
       FROM profile_consents pc
       WHERE pc.profile_id IN ($1, $2)
       AND pc.subject = $3
       ORDER BY pc.created_at DESC`,
      [loggedInUserId, interimUserId, ConsentSubjects.Messaging],
    );

    expect(consentRows).toHaveLength(2);

    // Both profiles should have the same consent status
    expect(consentRows[0].status).toBe(consentRows[1].status);
    expect(consentRows[0].status).toBe("undefined"); // Default status for new profiles

    // Debug: Check what hasPreviousConsent would return for the logged-in user
    await pool.query(
      `SELECT * FROM profile_consents 
       WHERE profile_id = $1 
       AND subject = $2 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [loggedInUserId, ConsentSubjects.Messaging],
    );

    // Verify cascade tracking - look for the account_linking cascade record
    const accountLinkingConsent = consentRows.find(
      (row) => row.cascade_reason === CascadeConsentReasons.AccountLinking,
    );
    expect(accountLinkingConsent).toBeDefined();
    expect(accountLinkingConsent?.profile_id).toBe(interimUserId);
    expect(accountLinkingConsent?.cascade_source_profile_id).toBe(
      loggedInUserId,
    );
  });

  it("should cascade consent directly when called", async () => {
    const interimUserId = randomUUID().substring(0, 12);
    const loggedInUserId = randomUUID().substring(0, 12);

    await pool.query(
      `INSERT INTO profiles (id, primary_user_id, email, public_name)
       VALUES ($1, $1, $2, $3)`,
      [loggedInUserId, "loggedin@example.com", "Logged In Public"],
    );

    // Create both profiles as primary profiles
    await pool.query(
      `INSERT INTO profiles (id, primary_user_id, email, public_name)
       VALUES ($1, $4, $2, $3)`,
      [interimUserId, "interim@example.com", "Interim Public", loggedInUserId],
    );

    // Call cascade function directly
    await withClient(pool, async (client) => {
      await WebhookConsentService.cascadeConsentOnAccountLinking({
        client,
        primaryUserId: loggedInUserId,
        linkedProfileId: interimUserId,
        logger: mockLogger as unknown as FastifyBaseLogger,
        currentConsentStatement: await getCurrentConsentStatement({
          pool,
          subject: ConsentSubjects.Messaging,
        }),
      });
    });

    // Verify consent was cascaded to both profiles
    const { rows: consentRows } = await pool.query(
      `SELECT pc.profile_id, pc.status, pc.cascade_reason, pc.cascade_source_profile_id
       FROM profile_consents pc
       WHERE pc.profile_id IN ($1, $2)
       AND pc.subject = $3
       ORDER BY pc.profile_id`,
      [loggedInUserId, interimUserId, ConsentSubjects.Messaging],
    );

    expect(consentRows).toHaveLength(2);

    // Both profiles should have the same consent status
    expect(consentRows[0].status).toBe(consentRows[1].status);
    expect(consentRows[0].status).toBe("undefined"); // Default status for new profiles

    // Verify cascade tracking
    const primaryConsent = consentRows.find(
      (row) => row.profile_id === loggedInUserId,
    );
    const linkedConsent = consentRows.find(
      (row) => row.profile_id === interimUserId,
    );

    expect(primaryConsent?.cascade_reason).toBeNull(); // Primary profile has no cascade reason
    expect(linkedConsent?.cascade_reason).toBe(
      CascadeConsentReasons.AccountLinking,
    );
    expect(linkedConsent?.cascade_source_profile_id).toBe(loggedInUserId);
  });
});
