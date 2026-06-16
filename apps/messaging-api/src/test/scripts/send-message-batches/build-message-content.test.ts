import { describe, expect, it } from "vitest";
import { buildMessageContent } from "../../../scripts/send-message-batches/template/build-message-content.js";

describe("buildMessageContent", () => {
  it("renders one message content entry using the approved variables only", () => {
    const content = buildMessageContent({
      subject: "Wallet pilot",
      htmlTemplate: "<p>Hello {{publicName}}</p>",
      txtTemplate: "Hello {{publicName}} at {{email}}",
      variables: {
        publicName: "Alice",
        email: "alice@example.com",
      },
    });

    expect(content).toEqual({
      threadName: "Wallet pilot",
      subject: "Wallet pilot",
      excerpt: "Hello Alice at alice@example.com",
      plainText: "Hello Alice at alice@example.com",
      richText: "<p>Hello Alice</p>",
    });
  });

  it("rejects unknown variables", () => {
    expect(() =>
      buildMessageContent({
        subject: "Wallet pilot",
        htmlTemplate: "<p>Hello {{firstName}}</p>",
        txtTemplate: "Hello {{publicName}}",
        variables: {
          publicName: "Alice",
          email: "alice@example.com",
        },
      }),
    ).toThrowError(/Unsupported template variable/);
  });
});
