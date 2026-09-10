import type { Messaging } from "@ogcio/building-blocks-sdk/dist/types/index.js";
import pino from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMessagesForUsers,
  sendPublicMessage,
} from "~/scripts/lifecycle-worker/steps/export-user-data/messages.js";

const logger = pino({ enabled: false });

const postMessagesSearch = vi.fn();
const send = vi.fn();
const messagingSupportSdk = {
  postMessagesSearch,
  send,
} as unknown as Messaging["support"];

describe("getMessagesForUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("collects messages grouped per recipient", async () => {
    postMessagesSearch.mockResolvedValue({
      data: [
        { id: "m1", recipientUserId: "u1" },
        { id: "m2", recipientUserId: "u2" },
      ],
      metadata: { totalCount: 2 },
    });

    const result = await getMessagesForUsers({
      userIds: ["u1", "u2"],
      messagingSupportSdk,
      logger,
    });

    expect(result).toEqual({
      success: true,
      data: {
        u1: [{ id: "m1", recipientUserId: "u1" }],
        u2: [{ id: "m2", recipientUserId: "u2" }],
      },
    });
    expect(postMessagesSearch).toHaveBeenCalledTimes(1);
  });

  it("paginates until all messages are fetched", async () => {
    const page = (ids: string[], totalCount: number) => ({
      data: ids.map((id) => ({ id, recipientUserId: "u1" })),
      metadata: { totalCount },
    });
    postMessagesSearch
      .mockResolvedValueOnce(
        page(["m0", "m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9"], 12),
      )
      .mockResolvedValueOnce(page(["m10", "m11"], 12));

    const result = await getMessagesForUsers({
      userIds: ["u1"],
      messagingSupportSdk,
      logger,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.u1).toHaveLength(12);
    }
    expect(postMessagesSearch).toHaveBeenCalledTimes(2);
    expect(postMessagesSearch).toHaveBeenLastCalledWith(
      { limit: "10", offset: "10" },
      { recipientUserIds: ["u1"] },
    );
  });

  it("batches user ids in groups of ten", async () => {
    postMessagesSearch.mockResolvedValue({ data: [], metadata: {} });
    const userIds = Array.from({ length: 11 }, (_, i) => `u${i}`);

    const result = await getMessagesForUsers({
      userIds,
      messagingSupportSdk,
      logger,
    });

    expect(result.success).toBe(true);
    expect(postMessagesSearch).toHaveBeenCalledTimes(2);
    expect(postMessagesSearch.mock.calls[0][1].recipientUserIds).toHaveLength(
      10,
    );
    expect(postMessagesSearch.mock.calls[1][1].recipientUserIds).toEqual([
      "u10",
    ]);
  });

  it("fails when the search returns an error", async () => {
    postMessagesSearch.mockResolvedValue({ error: { detail: "boom" } });

    const result = await getMessagesForUsers({
      userIds: ["u1"],
      messagingSupportSdk,
      logger,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain("u1");
    }
  });
});

describe("sendPublicMessage", () => {
  const params = {
    profile: { id: "u1", publicName: "Test", preferredLanguage: undefined },
    message: { subject: "s", plainText: "p", richText: "r" },
    messagingSupportSdk,
    logger,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends a public email message defaulting to english", async () => {
    send.mockResolvedValue({ data: { id: "msg-1" } });

    const result = await sendPublicMessage(params);

    expect(result).toEqual({ success: true, messageId: "msg-1" });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: "u1",
        security: "public",
        preferredTransports: ["email"],
        message: expect.objectContaining({ language: "en" }),
      }),
    );
  });

  it("uses the profile's preferred language when set", async () => {
    send.mockResolvedValue({ data: { id: "msg-1" } });

    await sendPublicMessage({
      ...params,
      profile: { ...params.profile, preferredLanguage: "ga" as const },
    });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({ language: "ga" }),
      }),
    );
  });

  it("reports failure when the sdk throws", async () => {
    send.mockRejectedValue(new Error("network down"));

    const result = await sendPublicMessage(params);

    expect(result).toEqual({ success: false, error: "network down" });
  });

  it("reports failure when the sdk throws a non-error", async () => {
    send.mockRejectedValue("weird failure");

    const result = await sendPublicMessage(params);

    expect(result).toEqual({ success: false, error: "Unknown error" });
  });

  it("reports failure when the response contains an error", async () => {
    send.mockResolvedValue({ error: { detail: "rejected" } });

    const result = await sendPublicMessage(params);

    expect(result.success).toBe(false);
  });

  it("reports failure when the sdk returns undefined", async () => {
    send.mockResolvedValue(undefined);

    const result = await sendPublicMessage(params);

    expect(result).toEqual({
      success: false,
      error: "No result returned from message send operation",
    });
  });
});
