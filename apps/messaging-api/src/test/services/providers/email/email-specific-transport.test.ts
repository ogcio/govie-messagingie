import { randomUUID } from "node:crypto";
import type SMTPTransport from "nodemailer/lib/smtp-transport/index.js";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { MessagingEventType } from "../../../../services/messages/event-logger.js";
import { EmailSpecificTransport } from "../../../../services/providers/email/email-specific-transport.js";
import type { EmailProvider } from "../../../../types/providers.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "../../../build-testcontainer-pg.js";

type SentEmail = { from: string; to: string; subject: string; html: string };
const sentEmails: Record<string, SentEmail> = {};
const createdTransporters: Record<string, SMTPTransport.Options> = {};

vi.mock("nodemailer", () => ({
  createTransport: vi.fn((transport: SMTPTransport.Options) => {
    // biome-ignore lint/style/noNonNullAssertion: we know it's set here
    createdTransporters[transport.host!] = transport;
    return {
      sendMail: (toSend: SentEmail) => {
        sentEmails[toSend.subject] = toSend;
      },
    };
  }),
}));

describe("Email Specific Transport", () => {
  let pool: Pool;

  beforeAll(() => {
    pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  const getMockProvider = (): EmailProvider => ({
    id: randomUUID(),
    providerName: `Pname${randomUUID().substring(0, 5)}`,
    isPrimary: true,
    type: "email",
    smtpHost: `${randomUUID().substring(0, 5)}.smtp.com`,
    smtpPort: 1234,
    username: randomUUID().substring(0, 8),
    password: randomUUID().substring(0, 10),
    throttle: 1000,
    fromAddress: `${randomUUID().substring(0, 5)}@email.com`,
    ssl: true,
    headers: { "X-Custom-Header": "CustomValue" },
  });

  it("should create correct transport", async () => {
    const mockProvider = getMockProvider();
    const transport = new EmailSpecificTransport(mockProvider);

    // send message must be invoked because the transporter
    // is created only once needed, not at constructor time
    await transport.sendMessage({
      message: {
        subject: "Send Email",
        excerpt: "Send Email",
        body: "SendEmail",
        attachmentIds: [],
        id: randomUUID(),
        securityLevel: "public",
      },
      recipientAddress: "the@recipient.com",
    });

    const createdTrans = createdTransporters[mockProvider.smtpHost];
    expect(createdTrans.host).toStrictEqual(mockProvider.smtpHost);
    expect(createdTrans.port).toStrictEqual(mockProvider.smtpPort);
    expect(createdTrans.secure).toStrictEqual(mockProvider.ssl);
    expect(createdTrans.auth).toStrictEqual({
      user: mockProvider.username,
      pass: mockProvider.password,
    });
  });

  it("sendMessage - should send email", async () => {
    const mockProvider = getMockProvider();
    const transport = new EmailSpecificTransport(mockProvider);

    await transport.sendMessage({
      message: {
        subject: "Send Email Test",
        excerpt: "Send Email",
        body: "SendEmail",
        attachmentIds: [],
        id: randomUUID(),
        securityLevel: "public",
      },
      recipientAddress: "the@recipient.com",
    });

    const sent = sentEmails["Send Email Test"];
    expect(sent.from).toContain(mockProvider.fromAddress);
    expect(sent.to).toStrictEqual("the@recipient.com");
    expect(sent.subject).toStrictEqual("Send Email Test");
    expect(sent.html).toBeUndefined();
  });

  it("checkIfMessageCanBeSent - valid configuration", async () => {
    const mockProvider = getMockProvider();
    const transport = new EmailSpecificTransport(mockProvider);

    const response = await transport.checkIfMessageCanBeSent({
      message: {
        id: randomUUID(),
        subject: "Send Email Test",
        excerpt: "Send Email",
        body: "SendEmail",
        attachmentIds: [],
        securityLevel: "public",
      },
      userAddress: "a@valid.address",
    });

    expect(response.canBeSent).toBe(true);
    expect(response.eventToLog).toBeUndefined();
  });

  it("checkIfMessageCanBeSent - missing subject", async () => {
    const mockProvider = getMockProvider();
    const transport = new EmailSpecificTransport(mockProvider);
    const messageId = randomUUID();

    const response = await transport.checkIfMessageCanBeSent({
      message: {
        id: messageId,
        subject: "",
        excerpt: "Send Email",
        body: "SendEmail",
        attachmentIds: [],
        securityLevel: "public",
      },
      userAddress: "a@valid.address",
    });

    expect(response.canBeSent).toBe(false);
    expect(response.eventToLog).toBeDefined();
    expect(response.eventToLog).toStrictEqual({
      type: MessagingEventType.emailError,
      eventData: {
        messageId: messageId,
        messageKey: "noSubject",
      },
    });
  });

  it("checkIfMessageCanBeSent - missing address", async () => {
    const mockProvider = getMockProvider();
    const transport = new EmailSpecificTransport(mockProvider);
    const messageId = randomUUID();

    const response = await transport.checkIfMessageCanBeSent({
      message: {
        id: messageId,
        subject: "sub",
        excerpt: "Send Email",
        body: "SendEmail",
        attachmentIds: [],
        securityLevel: "public",
      },
      userAddress: "",
    });

    expect(response.canBeSent).toBe(false);
    expect(response.eventToLog).toBeDefined();
    expect(response.eventToLog).toStrictEqual({
      type: MessagingEventType.emailError,
      eventData: {
        messageId: messageId,
        messageKey: "noEmail",
      },
    });
  });
});
