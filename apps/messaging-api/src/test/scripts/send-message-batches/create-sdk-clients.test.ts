import { beforeEach, describe, expect, it, vi } from "vitest";

const findProfile = vi.fn();
const send = vi.fn();
const getEventsForMessage = vi.fn();
const getBuildingBlockSDK = vi.fn(() => ({
  profile: { findProfile },
  messaging: { send, getEventsForMessage },
}));

vi.mock("@ogcio/building-blocks-sdk", () => ({
  getBuildingBlockSDK: (...args: unknown[]) => getBuildingBlockSDK(...args),
}));

const { createSdkClients } = await import(
  "../../../scripts/send-message-batches/clients/create-sdk-clients.js"
);

function makeClients(params?: { richTextEncodeBase64?: boolean }) {
  return createSdkClients({
    profileBackendUrl: "https://profile.example",
    messagingBackendUrl: "https://messaging.example",
    tokenClient: { getAccessToken: vi.fn().mockResolvedValue("token") },
    ...params,
  });
}

const sendRequest = {
  recipientProfileId: "profile-1",
  recipientEmail: "user@example.com",
  scheduleAt: new Date("2026-01-01T00:00:00.000Z"),
  content: {
    threadName: "thread",
    subject: "subject",
    excerpt: "excerpt",
    plainText: "plain",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("profile.findProfile", () => {
  it("maps enveloped profile matches with consent status", async () => {
    findProfile.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: "profile-1",
            email: "user@example.com",
            publicName: "User One",
            status: "active",
            consentStatuses: { messaging: { status: "opted-in" } },
          },
          { email: "missing-id@example.com" },
          "not-an-object",
        ],
      },
    });

    const { profile } = makeClients();
    const matches = await profile.findProfile("user@example.com");

    expect(findProfile).toHaveBeenCalledWith({
      email: "user@example.com",
      consentSubjects: ["messaging"],
    });
    expect(matches).toEqual([
      {
        profileId: "profile-1",
        publicName: "User One",
        email: "user@example.com",
        consentStatus: "opted-in",
        profileStatus: "active",
      },
    ]);
  });

  it("maps a bare single-object response without consent data", async () => {
    findProfile.mockResolvedValueOnce({
      data: { id: "profile-2", email: "two@example.com" },
    });

    const { profile } = makeClients();
    const matches = await profile.findProfile("two@example.com");

    expect(matches).toEqual([
      {
        profileId: "profile-2",
        publicName: null,
        email: "two@example.com",
        consentStatus: null,
        profileStatus: null,
      },
    ]);
  });

  it("normalizes structured SDK errors (client errors are not retried)", async () => {
    findProfile.mockResolvedValue({
      error: {
        detail: "profile not found",
        code: "NOT_FOUND",
        statusCode: 404,
      },
    });

    const { profile } = makeClients();
    await expect(profile.findProfile("user@example.com")).rejects.toMatchObject(
      {
        message: "profile not found",
        status: 404,
        statusCode: 404,
        code: "NOT_FOUND",
      },
    );
    expect(findProfile).toHaveBeenCalledTimes(1);
  });

  it("normalizes raw string error bodies (proxy/WAF)", async () => {
    findProfile.mockResolvedValue({
      error: `<html>\n  Blocked by CloudFront  </html>`,
    });

    const { profile } = makeClients();
    await expect(profile.findProfile("user@example.com")).rejects.toThrow(
      /upstream returned non-JSON response: <html> Blocked by CloudFront/,
    );
  });

  it("falls back to a generic message for unrecognized errors", async () => {
    findProfile.mockResolvedValue({ error: { statusCode: 418 } });

    const { profile } = makeClients();
    await expect(profile.findProfile("user@example.com")).rejects.toThrow(
      "SDK request failed with status 418",
    );
  });
});

describe("messaging.sendMessage", () => {
  it("sends without richText and returns the message id", async () => {
    send.mockResolvedValueOnce({ data: { data: { id: "message-1" } } });

    const { messaging } = makeClients();
    const result = await messaging.sendMessage(sendRequest);

    expect(result).toEqual({ messageId: "message-1" });
    const payload = send.mock.calls[0]?.[0];
    expect(payload.recipientUserId).toBe("profile-1");
    expect(payload.scheduleAt).toBe("2026-01-01T00:00:00.000Z");
    expect(payload.message).not.toHaveProperty("richText");
  });

  it("passes richText through verbatim by default", async () => {
    send.mockResolvedValueOnce({ data: { id: "message-2" } });

    const { messaging } = makeClients();
    await messaging.sendMessage({
      ...sendRequest,
      content: { ...sendRequest.content, richText: "<p>hi</p>" },
    });

    expect(send.mock.calls[0]?.[0].message.richText).toBe("<p>hi</p>");
  });

  it("base64-encodes richText when configured", async () => {
    send.mockResolvedValueOnce({ data: { id: "message-3" } });

    const { messaging } = makeClients({ richTextEncodeBase64: true });
    await messaging.sendMessage({
      ...sendRequest,
      content: { ...sendRequest.content, richText: "<p>hi</p>" },
    });

    expect(send.mock.calls[0]?.[0].message.richText).toBe(
      Buffer.from("<p>hi</p>", "utf8").toString("base64"),
    );
  });

  it("throws when the response has an error", async () => {
    send.mockResolvedValueOnce({ error: { detail: "rejected" } });

    const { messaging } = makeClients();
    await expect(messaging.sendMessage(sendRequest)).rejects.toThrow(
      "rejected",
    );
  });

  it("throws when the response has no message id", async () => {
    send.mockResolvedValueOnce({ data: { data: {} } });

    const { messaging } = makeClients();
    await expect(messaging.sendMessage(sendRequest)).rejects.toThrow(
      /did not include a message id/,
    );
  });
});

describe("messaging.getEventsForMessage", () => {
  it("maps enveloped delivery events and drops malformed entries", async () => {
    getEventsForMessage.mockResolvedValueOnce({
      data: {
        data: [
          {
            eventType: "delivery",
            eventStatus: "delivered",
            createdAt: "2026-01-02T03:04:05.000Z",
            data: { transport: "email" },
          },
          { eventType: "delivery" },
          null,
        ],
      },
    });

    const { messaging } = makeClients();
    const events = await messaging.getEventsForMessage("message-1");

    expect(events).toEqual([
      {
        eventType: "delivery",
        eventStatus: "delivered",
        eventPayload: { transport: "email" },
        eventAt: new Date("2026-01-02T03:04:05.000Z"),
      },
    ]);
  });

  it("returns an empty list for non-array data", async () => {
    getEventsForMessage.mockResolvedValueOnce({ data: { data: null } });

    const { messaging } = makeClients();
    await expect(messaging.getEventsForMessage("message-1")).resolves.toEqual(
      [],
    );
  });

  it("normalizes SDK errors", async () => {
    getEventsForMessage.mockResolvedValue({ error: { code: "FORBIDDEN" } });

    const { messaging } = makeClients();
    await expect(
      messaging.getEventsForMessage("message-1"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
