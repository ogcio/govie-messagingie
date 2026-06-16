import { randomBytes, randomUUID } from "node:crypto";
import { NodeCache } from "@cacheable/node-cache";
import type { Pool } from "pg";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { EnvConfig } from "../../../plugins/external/env.js";
import {
  executeJob,
  getPendingJobPerOrganization,
  JobStatus,
} from "../../../services/jobs/job-service.js";
import {
  MessagingEventLogger,
  MessagingEventType,
} from "../../../services/messages/event-logger.js";
import { EmailSpecificProvider } from "../../../services/providers/email/email-specific-provider.js";
import { AvailableTransports } from "../../../services/users/shared-users.js";
import { ProviderTypes } from "../../../types/providers.js";
import CryptographyService from "../../../utils/cryptography-service.js";
import { Translator } from "../../../utils/i18n.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "../../build-testcontainer-pg.js";
import { getMockBaseLogger } from "../../test-server-builder.js";
import {
  deleteJobsAndRelatedForOrganization,
  getJob,
  getMessage,
  insertMockJob,
  insertMockMessage,
} from "./job-service-utils.js";

const organizationId = "job-service-org";
const mockLogger = getMockBaseLogger();
let pool: Pool;
let eventLogger: MessagingEventLogger;
// biome-ignore lint/suspicious/noExplicitAny: insert any type
let cache: NodeCache<any>;

const hoisted = vi.hoisted(() => {
  const state = {
    mustEmailSendingFail: false,
    sentEmails: [] as { html: string; text: string; subject: string }[],
    doesProfileExist: true,
    hasProfileValidEmail: true,
    preferredLanguage: "en",
  };

  const organizationNotExistId = "non-existent-org";

  const getMockProfile = (profileId: string) => ({
    id: profileId,
    publicName: "Mock Public Name",
    email: "e@mail.com",
    primaryUserId: profileId,
    safeLevel: 0,
    preferredLanguage: state.preferredLanguage,
    createdAt: new Date(new Date().toUTCString()).toISOString(),
    updatedAt: new Date(new Date().toUTCString()).toISOString(),
    details: {
      email: "e@mail.com",
      firstName: "Name",
      lastName: "Surname",
      phone: "1234567890",
      address: "123 Main St",
    },
    linkedProfiles: [],
  });

  const getMockOrganisation = (orgId: string) => ({
    id: orgId,
    translations: {
      en: {
        name: "EN Mock Organisation",
        shortName: "EN Mock Org",
      },
      ga: {
        name: "GA Mock Organisation",
        shortName: "GA Mock Org",
      },
    },
  });

  const createHttpError = (statusCode: number, message: string) => {
    const error = new Error(message) as Error & { statusCode: number };
    error.statusCode = statusCode;
    return error;
  };

  return {
    state,
    organizationNotExistId,
    getMockProfile,
    getMockOrganisation,
    createHttpError,
  };
});

vi.mock("nodemailer", () => ({
  createTransport: vi.fn((_transport: unknown) => {
    return {
      sendMail: (toSend: { html: string; text: string; subject: string }) => {
        if (hoisted.state.mustEmailSendingFail) {
          throw new Error("Mail sending failed");
        }
        hoisted.state.sentEmails.push(toSend);
      },
    };
  }),
}));

vi.mock("../../../services/users/profile-sdk-wrapper.js", () => {
  return {
    // biome-ignore lint/complexity/useArrowFunction: Vitest 4 requires function (not arrow) for class constructor mocks
    ProfileSdkWrapper: vi.fn().mockImplementation(function () {
      return {
        getProfile: vi.fn((profileId: string) => {
          if (!hoisted.state.doesProfileExist) {
            throw hoisted.createHttpError(
              503,
              "Failed fetching user from profile sdk",
            );
          }
          if (hoisted.state.hasProfileValidEmail) {
            return hoisted.getMockProfile(profileId);
          }
          return { ...hoisted.getMockProfile(profileId), email: "" };
        }),
        getOrganisationWithCache: vi.fn((orgId: string, _cache, _logger) => {
          if (orgId === hoisted.organizationNotExistId) {
            throw hoisted.createHttpError(
              503,
              "Failed fetching organisation from profile sdk",
            );
          }
          return hoisted.getMockOrganisation(orgId);
        }),
      };
    }),
  };
});

beforeAll(() => {
  pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
  cache = new NodeCache();
});

beforeEach(() => {
  eventLogger = new MessagingEventLogger(pool, mockLogger);
  hoisted.state.doesProfileExist = true;
  hoisted.state.mustEmailSendingFail = false;
  hoisted.state.hasProfileValidEmail = true;
  hoisted.state.sentEmails = [];
  hoisted.state.preferredLanguage = "en";
  cache.flushAll();
});

afterEach(async () => {
  await deleteJobsAndRelatedForOrganization(pool, organizationId);
});

afterAll(async () => {
  if (pool) {
    await pool.end();
  }
});

describe("Execute job", () => {
  it("should handle errors if no job exists", async () => {
    await expect(
      executeJob({
        pool,
        logger: mockLogger,
        jobId: randomUUID(),
        token: randomUUID(),
        eventLogger,
        i18n: new Translator(),
        config: {} as EnvConfig,
        cache,
      }),
    ).rejects.toThrow("job doesn't exist");
  });

  it("should throw if already running", async () => {
    const insertedJob = await insertMockJob({
      pool,
      organizationId,
      status: "working",
    });
    await expect(
      executeJob({
        pool,
        logger: mockLogger,
        jobId: insertedJob.jobId,
        token: insertedJob.token,
        eventLogger,
        i18n: new Translator(),
        config: {} as EnvConfig,
        cache,
      }),
    ).rejects.toThrow("job is already in progress");
  });

  it("should set jobs as failed if message does not exist", async () => {
    const insertedJob = await insertMockJob({ pool, organizationId });
    await executeJob({
      pool,
      logger: mockLogger,
      jobId: insertedJob.jobId,
      token: insertedJob.token,
      eventLogger,
      i18n: new Translator(),
      config: {} as EnvConfig,
      cache,
    });

    const job = await getJob(pool, insertedJob.jobId, organizationId);

    expect(job).toBeDefined();
    expect(job?.status).toStrictEqual(JobStatus.Failed);

    const events = await eventLogger.getEvents();
    expect(events.length).toBeGreaterThan(0);
    const errorEvent = events.find(
      (e) => e.type === MessagingEventType.deliverMessageError,
    );
    expect(errorEvent).toBeDefined();
    if (errorEvent && "messageKey" in errorEvent.event) {
      expect(errorEvent.event.messageKey).toBe("messageFetchError");
    }
  });

  it("should set jobs and messages as delivered if message does not have transports", async () => {
    const insertedMessage = await insertMockMessage({
      pool,
      organizationId,
      transports: [],
    });

    const insertedJob = await insertMockJob({
      pool,
      organizationId,
      entityId: insertedMessage.id,
      userId: insertedMessage.user_id,
    });

    await executeJob({
      pool,
      logger: mockLogger,
      jobId: insertedJob.jobId,
      token: insertedJob.token,
      eventLogger,
      i18n: new Translator(),
      config: {} as EnvConfig,
      cache,
    });

    const job = await getJob(pool, insertedJob.jobId, organizationId);
    expect(job).toBeDefined();
    expect(job?.status).toStrictEqual(JobStatus.Delivered);
    const gotMessage = await getMessage(
      pool,
      insertedJob.userId,
      insertedMessage.id,
    );
    expect(gotMessage).toBeDefined();
    expect(gotMessage?.delivered).toStrictEqual(true);

    const events = await eventLogger.getEvents();
    const deliverEvent = events.find(
      (e) => e.type === MessagingEventType.deliverMessage,
    );
    expect(deliverEvent).toBeDefined();
  });

  it("should set jobs as delivered if only sent to LifeEvents", async () => {
    const insertedMessage = await insertMockMessage({
      pool,
      organizationId,
      transports: [AvailableTransports.LIFE_EVENT],
    });

    const insertedJob = await insertMockJob({
      pool,
      organizationId,
      entityId: insertedMessage.id,
      userId: insertedMessage.user_id,
    });

    await executeJob({
      pool,
      logger: mockLogger,
      jobId: insertedJob.jobId,
      token: insertedJob.token,
      eventLogger,
      i18n: new Translator(),
      config: {} as EnvConfig,
      cache,
    });

    const job = await getJob(pool, insertedJob.jobId, organizationId);
    const gotMessage = await getMessage(
      pool,
      insertedJob.userId,
      insertedMessage.id,
    );
    expect(job).toBeDefined();
    expect(job?.status).toStrictEqual(JobStatus.Delivered);

    expect(gotMessage).toBeDefined();
    expect(gotMessage?.delivered).toStrictEqual(true);

    const events = await eventLogger.getEvents();
    const deliverEvent = events.find(
      (e) => e.type === MessagingEventType.deliverMessage,
    );
    expect(deliverEvent).toBeDefined();
  });

  it("should set jobs as failed if profile does not exist", async () => {
    hoisted.state.doesProfileExist = false;
    const insertedMessage = await insertMockMessage({
      pool,
      organizationId,
      transports: [AvailableTransports.EMAIL],
    });

    const insertedJob = await insertMockJob({
      pool,
      organizationId,
      entityId: insertedMessage.id,
      userId: insertedMessage.user_id,
    });

    await executeJob({
      pool,
      logger: mockLogger,
      jobId: insertedJob.jobId,
      token: insertedJob.token,
      eventLogger,
      i18n: new Translator(),
      config: {} as EnvConfig,
      cache,
    });

    const job = await getJob(pool, insertedJob.jobId, organizationId);
    const gotMessage = await getMessage(
      pool,
      insertedJob.userId,
      insertedMessage.id,
    );
    expect(job).toBeDefined();
    expect(job?.status).toStrictEqual(JobStatus.Failed);

    expect(gotMessage).toBeDefined();
    expect(gotMessage?.delivered).toStrictEqual(false);

    const events = await eventLogger.getEvents();
    const errorEvent = events.find(
      (e) => e.type === MessagingEventType.deliverMessageError,
    );
    expect(errorEvent).toBeDefined();
    if (errorEvent && "messageKey" in errorEvent.event) {
      expect(errorEvent.event.messageKey).toBe("profileFetchError");
    }
  });

  it("should set jobs as succesful if email succeeds", async () => {
    const encryptionKey = randomBytes(32).toString("base64");
    const provider = new EmailSpecificProvider(
      pool,
      organizationId,
      new CryptographyService({
        EMAIL_PROVIDER_SMTP_ENCRYPTION_KEY: encryptionKey,
      }),
    );
    await provider.create({
      inputBody: {
        fromAddress: "mock@mail.com",
        providerName: "MockName",
        isPrimary: true,
        type: ProviderTypes.Email,
        smtpHost: "host",
        smtpPort: 123,
        username: "user",
        password: "supersecret",
        ssl: true,
        headers: null,
      },
    });
    const insertedMessage = await insertMockMessage({
      pool,
      organizationId,
      transports: [AvailableTransports.EMAIL],
    });

    const insertedJob = await insertMockJob({
      pool,
      organizationId,
      entityId: insertedMessage.id,
      userId: insertedMessage.user_id,
    });

    await executeJob({
      pool,
      logger: mockLogger,
      jobId: insertedJob.jobId,
      token: insertedJob.token,
      eventLogger,
      i18n: new Translator(),
      config: {
        EMAIL_PROVIDER_SMTP_ENCRYPTION_KEY: encryptionKey,
      } as EnvConfig,
      cache,
    });

    const job = await getJob(pool, insertedJob.jobId, organizationId);
    const gotMessage = await getMessage(
      pool,
      insertedJob.userId,
      insertedMessage.id,
    );
    expect(job).toBeDefined();
    expect(job?.status).toStrictEqual(JobStatus.Delivered);

    expect(gotMessage).toBeDefined();
    expect(gotMessage?.delivered).toStrictEqual(true);

    const events = await eventLogger.getEvents();
    const deliverEvent = events.find(
      (e) => e.type === MessagingEventType.deliverMessage,
    );
    expect(deliverEvent).toBeDefined();
  });

  it("should set jobs as failed if email sending fails", async () => {
    hoisted.state.mustEmailSendingFail = true;
    const encryptionKey = randomBytes(32).toString("base64");
    const provider = new EmailSpecificProvider(
      pool,
      organizationId,
      new CryptographyService({
        EMAIL_PROVIDER_SMTP_ENCRYPTION_KEY: encryptionKey,
      }),
    );
    await provider.create({
      inputBody: {
        fromAddress: "mock@mail.com",
        providerName: "MockName",
        isPrimary: true,
        type: ProviderTypes.Email,
        smtpHost: "host",
        smtpPort: 123,
        username: "user",
        password: "supersecret",
        ssl: true,
        headers: null,
      },
    });
    const insertedMessage = await insertMockMessage({
      pool,
      organizationId,
      transports: [AvailableTransports.LIFE_EVENT, AvailableTransports.EMAIL],
    });

    const insertedJob = await insertMockJob({
      pool,
      organizationId,
      entityId: insertedMessage.id,
      userId: insertedMessage.user_id,
    });

    await executeJob({
      pool,
      logger: mockLogger,
      jobId: insertedJob.jobId,
      token: insertedJob.token,
      eventLogger,
      i18n: new Translator(),
      config: {
        EMAIL_PROVIDER_SMTP_ENCRYPTION_KEY: encryptionKey,
      } as EnvConfig,
      cache,
    });

    const job = await getJob(pool, insertedJob.jobId, organizationId);
    const gotMessage = await getMessage(
      pool,
      insertedJob.userId,
      insertedMessage.id,
    );
    expect(job).toBeDefined();
    expect(job?.status).toStrictEqual(JobStatus.Failed);

    expect(gotMessage).toBeDefined();
    expect(gotMessage?.delivered).toStrictEqual(false);

    const events = await eventLogger.getEvents();
    const errorEvent = events.find(
      (e) => e.type === MessagingEventType.emailError,
    );

    expect(errorEvent).toBeDefined();
    if (errorEvent && "messageKey" in errorEvent.event) {
      expect(errorEvent.event.messageKey).toBe("failedToSend");
    }
  });

  it("should set jobs as failed if email address is empty", async () => {
    hoisted.state.hasProfileValidEmail = false;
    const encryptionKey = randomBytes(32).toString("base64");
    const provider = new EmailSpecificProvider(
      pool,
      organizationId,
      new CryptographyService({
        EMAIL_PROVIDER_SMTP_ENCRYPTION_KEY: encryptionKey,
      }),
    );
    await provider.create({
      inputBody: {
        fromAddress: "mock@mail.com",
        providerName: "MockName",
        isPrimary: true,
        type: ProviderTypes.Email,
        smtpHost: "host",
        smtpPort: 123,
        username: "user",
        password: "supersecret",
        ssl: true,
        headers: null,
      },
    });
    const insertedMessage = await insertMockMessage({
      pool,
      organizationId,
      transports: [AvailableTransports.EMAIL],
    });

    const insertedJob = await insertMockJob({
      pool,
      organizationId,
      entityId: insertedMessage.id,
      userId: insertedMessage.user_id,
    });

    await executeJob({
      pool,
      logger: mockLogger,
      jobId: insertedJob.jobId,
      token: insertedJob.token,
      eventLogger,
      i18n: new Translator(),
      config: {
        EMAIL_PROVIDER_SMTP_ENCRYPTION_KEY: encryptionKey,
      } as EnvConfig,
      cache,
    });

    const job = await getJob(pool, insertedJob.jobId, organizationId);
    const gotMessage = await getMessage(
      pool,
      insertedJob.userId,
      insertedMessage.id,
    );
    expect(job).toBeDefined();
    expect(job?.status).toStrictEqual(JobStatus.Failed);

    expect(gotMessage).toBeDefined();
    expect(gotMessage?.delivered).toStrictEqual(false);

    const events = await eventLogger.getEvents();
    const errorEvent = events.find(
      (e) => e.type === MessagingEventType.emailError,
    );
    expect(errorEvent).toBeDefined();
    if (errorEvent && "messageKey" in errorEvent.event) {
      expect(errorEvent.event.messageKey).toBe("noEmail");
    }
  });

  it("should set jobs as failed if cannot fetch organisation", async () => {
    const encryptionKey = randomBytes(32).toString("base64");
    const provider = new EmailSpecificProvider(
      pool,
      hoisted.organizationNotExistId,
      new CryptographyService({
        EMAIL_PROVIDER_SMTP_ENCRYPTION_KEY: encryptionKey,
      }),
    );
    await provider.create({
      inputBody: {
        fromAddress: "mock@mail.com",
        providerName: "MockName",
        isPrimary: true,
        type: ProviderTypes.Email,
        smtpHost: "host",
        smtpPort: 123,
        username: "user",
        password: "supersecret",
        ssl: true,
        headers: null,
      },
    });
    const insertedMessage = await insertMockMessage({
      pool,
      organizationId: hoisted.organizationNotExistId,
      transports: [AvailableTransports.EMAIL],
    });

    const insertedJob = await insertMockJob({
      pool,
      organizationId: hoisted.organizationNotExistId,
      entityId: insertedMessage.id,
      userId: insertedMessage.user_id,
    });

    await executeJob({
      pool,
      logger: mockLogger,
      jobId: insertedJob.jobId,
      token: insertedJob.token,
      eventLogger,
      i18n: new Translator(),
      config: {
        EMAIL_PROVIDER_SMTP_ENCRYPTION_KEY: encryptionKey,
      } as EnvConfig,
      cache,
    });

    const job = await getJob(
      pool,
      insertedJob.jobId,
      hoisted.organizationNotExistId,
    );
    const gotMessage = await getMessage(
      pool,
      insertedJob.userId,
      insertedMessage.id,
    );
    expect(job).toBeDefined();
    expect(job?.status).toStrictEqual(JobStatus.Failed);

    expect(gotMessage).toBeDefined();
    expect(gotMessage?.delivered).toStrictEqual(false);

    const events = await eventLogger.getEvents();
    const errorEvent = events.find(
      (e) => e.type === MessagingEventType.deliverMessageError,
    );
    expect(errorEvent).toBeDefined();
    if (errorEvent && "messageKey" in errorEvent.event) {
      expect(errorEvent.event.messageKey).toBe("organisationFetchError");
    }
  });

  it("should use default provider if primary email provider is missing", async () => {
    // no provider is created
    const insertedMessage = await insertMockMessage({
      pool,
      organizationId,
      transports: [AvailableTransports.LIFE_EVENT, AvailableTransports.EMAIL],
    });

    const insertedJob = await insertMockJob({
      pool,
      organizationId,
      entityId: insertedMessage.id,
      userId: insertedMessage.user_id,
    });

    await executeJob({
      pool,
      logger: mockLogger,
      jobId: insertedJob.jobId,
      token: insertedJob.token,
      eventLogger,
      i18n: new Translator(),
      config: {
        EMAIL_PROVIDER_SMTP_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
      } as EnvConfig,
      cache,
    });

    const job = await getJob(pool, insertedJob.jobId, organizationId);
    const gotMessage = await getMessage(
      pool,
      insertedJob.userId,
      insertedMessage.id,
    );
    expect(job).toBeDefined();
    expect(job?.status).toStrictEqual(JobStatus.Delivered);

    expect(gotMessage).toBeDefined();
    expect(gotMessage?.delivered).toStrictEqual(true);

    const events = await eventLogger.getEvents();
    const deliverEvent = events.find(
      (e) => e.type === MessagingEventType.deliverMessage,
    );
    expect(deliverEvent).toBeDefined();
  });

  it("should send confidential message body when requested", async () => {
    const encryptionKey = randomBytes(32).toString("base64");
    const provider = new EmailSpecificProvider(
      pool,
      organizationId,
      new CryptographyService({
        EMAIL_PROVIDER_SMTP_ENCRYPTION_KEY: encryptionKey,
      }),
    );
    await provider.create({
      inputBody: {
        fromAddress: "mock@mail.com",
        providerName: "MockName",
        isPrimary: true,
        type: ProviderTypes.Email,
        smtpHost: "host",
        smtpPort: 123,
        username: "user",
        password: "supersecret",
        ssl: true,
        headers: null,
      },
    });
    const insertedMessage = await insertMockMessage({
      pool,
      organizationId,
      transports: [AvailableTransports.EMAIL],
      securityLevel: "confidential",
    });

    const insertedJob = await insertMockJob({
      pool,
      organizationId,
      entityId: insertedMessage.id,
      userId: insertedMessage.user_id,
    });

    await executeJob({
      pool,
      logger: mockLogger,
      jobId: insertedJob.jobId,
      token: insertedJob.token,
      eventLogger,
      i18n: new Translator(),
      config: {
        EMAIL_PROVIDER_SMTP_ENCRYPTION_KEY: encryptionKey,
      } as EnvConfig,
      cache,
    });

    const job = await getJob(pool, insertedJob.jobId, organizationId);
    const gotMessage = await getMessage(
      pool,
      insertedJob.userId,
      insertedMessage.id,
    );
    expect(job).toBeDefined();
    expect(job?.status).toStrictEqual(JobStatus.Delivered);

    expect(gotMessage).toBeDefined();
    expect(gotMessage?.delivered).toStrictEqual(true);
    const mockOrgTranslations = hoisted.getMockOrganisation(organizationId);

    expect(hoisted.state.sentEmails[0].html).toContain(
      mockOrgTranslations.translations.en.name,
    );
    expect(hoisted.state.sentEmails[0].html).toContain(
      "<p>A new message has been sent to your MessagingIE account",
    );
    expect(hoisted.state.sentEmails[0].subject).toContain(
      "You have received a new secure message",
    );
    expect(hoisted.state.sentEmails[0].subject).toContain(
      mockOrgTranslations.translations.en.name,
    );
    expect(hoisted.state.sentEmails[0].text).toContain(
      "A new message has been sent to your MessagingIE account",
    );
    expect(hoisted.state.sentEmails[0].text).toContain(
      mockOrgTranslations.translations.en.name,
    );

    const events = await eventLogger.getEvents();
    const deliverEvent = events.find(
      (e) => e.type === MessagingEventType.deliverMessage,
    );
    expect(deliverEvent).toBeDefined();
  });

  it("should send confidential message body when requested  - ga translation", async () => {
    const encryptionKey = randomBytes(32).toString("base64");
    hoisted.state.preferredLanguage = "ga";
    const provider = new EmailSpecificProvider(
      pool,
      organizationId,
      new CryptographyService({
        EMAIL_PROVIDER_SMTP_ENCRYPTION_KEY: encryptionKey,
      }),
    );
    await provider.create({
      inputBody: {
        fromAddress: "mock@mail.com",
        providerName: "MockName",
        isPrimary: true,
        type: ProviderTypes.Email,
        smtpHost: "host",
        smtpPort: 123,
        username: "user",
        password: "supersecret",
        ssl: true,
        headers: null,
      },
    });
    const insertedMessage = await insertMockMessage({
      pool,
      organizationId,
      transports: [AvailableTransports.EMAIL],
      securityLevel: "confidential",
    });

    const insertedJob = await insertMockJob({
      pool,
      organizationId,
      entityId: insertedMessage.id,
      userId: insertedMessage.user_id,
    });

    await executeJob({
      pool,
      logger: mockLogger,
      jobId: insertedJob.jobId,
      token: insertedJob.token,
      eventLogger,
      i18n: new Translator(),
      config: {
        EMAIL_PROVIDER_SMTP_ENCRYPTION_KEY: encryptionKey,
      } as EnvConfig,
      cache,
    });

    const mockOrgTranslations = hoisted.getMockOrganisation(organizationId);

    expect(hoisted.state.sentEmails[0].html).toContain(
      "<p>A Mock Public Name, a chara,",
    );
    expect(hoisted.state.sentEmails[0].html).toContain(
      mockOrgTranslations.translations.ga.name,
    );
    expect(hoisted.state.sentEmails[0].subject).toContain(
      "Tá teachtaireacht shlán nua faighte agat",
    );
    expect(hoisted.state.sentEmails[0].subject).toContain(
      mockOrgTranslations.translations.ga.name,
    );
    expect(hoisted.state.sentEmails[0].text).toContain(
      "Tá teachtaireacht nua seolta chuig do chuntas MessagingIE",
    );
    expect(hoisted.state.sentEmails[0].text).toContain(
      mockOrgTranslations.translations.ga.name,
    );

    const events = await eventLogger.getEvents();
    const deliverEvent = events.find(
      (e) => e.type === MessagingEventType.deliverMessage,
    );
    expect(deliverEvent).toBeDefined();
  });

  it("getPendingJobPerOrganization should work as expected", async () => {
    const pendingOrg = randomUUID().substring(0, 8);
    const insertedMessage = await insertMockMessage({
      pool,
      organizationId: pendingOrg,
      transports: [AvailableTransports.LIFE_EVENT, AvailableTransports.EMAIL],
    });

    await insertMockJob({
      pool,
      organizationId: pendingOrg,
      entityId: insertedMessage.id,
      userId: insertedMessage.user_id,
      status: "pending",
    });
    // Job that should not be counted as pending as it's already delivered
    await insertMockJob({
      pool,
      organizationId: pendingOrg,
      entityId: insertedMessage.id,
      userId: insertedMessage.user_id,
      status: "delivered",
    });

    const secondPendingOrg = randomUUID().substring(0, 8);
    const secondInsertedMessage = await insertMockMessage({
      pool,
      organizationId: secondPendingOrg,
      transports: [AvailableTransports.LIFE_EVENT, AvailableTransports.EMAIL],
    });

    await insertMockJob({
      pool,
      organizationId: secondPendingOrg,
      entityId: secondInsertedMessage.id,
      userId: secondInsertedMessage.user_id,
      status: "pending",
    });

    const jobs = await getPendingJobPerOrganization({
      pool,
      logger: mockLogger,
    });

    expect(jobs).toBeDefined();
    expect(Array.isArray(jobs)).toBe(true);
    expect(jobs.length).toBeGreaterThan(0);
    const pendingOrgJob = jobs.find((j) => j.organizationId === pendingOrg);
    const pendingSecondOrgJob = jobs.find(
      (j) => j.organizationId === secondPendingOrg,
    );
    expect(pendingOrgJob).toBeDefined();
    expect(pendingSecondOrgJob).toBeDefined();
    expect(pendingOrgJob?.counter).toBe(1);
    expect(pendingSecondOrgJob?.counter).toBe(1);
  });
});
