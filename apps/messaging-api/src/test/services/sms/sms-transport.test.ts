import type { FastifyBaseLogger } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EnvConfig } from "../../../plugins/external/env.js";

const snsSend = vi.fn();

vi.mock("@aws-sdk/client-sns", () => ({
  SNSClient: class {
    send = snsSend;
  },
  PublishCommand: class {
    constructor(public input: unknown) {}
  },
}));

const { SnsSmsTransport } = await import(
  "../../../services/sms/sms-transport.js"
);

const logger = { error: vi.fn() } as unknown as FastifyBaseLogger;
const config = {
  SNS_REGION: "eu-west-1",
  SNS_SENDER_ID: "GOVIE",
} as EnvConfig;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SnsSmsTransport", () => {
  it("publishes the SMS and returns the message id", async () => {
    snsSend.mockResolvedValueOnce({ MessageId: "sns-1" });

    const transport = new SnsSmsTransport({ config, logger });
    const result = await transport.sendSms("hello", "+353870000000");

    expect(result).toEqual({ messageId: "sns-1" });
    const command = snsSend.mock.calls[0]?.[0] as {
      input: Record<string, unknown>;
    };
    expect(command.input).toMatchObject({
      Message: "hello",
      PhoneNumber: "+353870000000",
    });
  });

  it("logs and returns undefined message id on failure", async () => {
    snsSend.mockRejectedValueOnce(new Error("sns down"));

    const transport = new SnsSmsTransport({ config, logger });
    const result = await transport.sendSms("hello", "+353870000000");

    expect(result).toEqual({ messageId: undefined });
    expect(logger.error).toHaveBeenCalled();
  });
});
