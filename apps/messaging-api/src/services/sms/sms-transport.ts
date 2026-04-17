import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import type { FastifyBaseLogger } from "fastify";
import type { EnvConfig } from "../../plugins/external/env.js";

export interface SmsTransport {
  sendSms(
    message: string,
    phoneNumber: string,
  ): Promise<{
    messageId: string | undefined;
  }>;
}

export class SnsSmsTransport implements SmsTransport {
  private readonly snsClient: SNSClient;

  constructor(
    private readonly params: { config: EnvConfig; logger: FastifyBaseLogger },
  ) {
    this.snsClient = new SNSClient({
      region: this.params.config.SNS_REGION,
    });
  }

  async sendSms(
    message: string,
    phoneNumber: string,
  ): Promise<{
    messageId: string | undefined;
  }> {
    try {
      const result = await this.snsClient.send(
        new PublishCommand({
          Message: message,
          PhoneNumber: phoneNumber,
          MessageAttributes: {
            "AWS.SNS.SMS.SenderID": {
              DataType: "String",
              StringValue: this.params.config.SNS_SENDER_ID,
            },
            "AWS.SNS.SMS.SMSType": {
              DataType: "String",
              StringValue: "Transactional", // or 'Promotional'
            },
          },
        }),
      );
      return {
        messageId: result.MessageId,
      };
    } catch (error) {
      this.params.logger.error(
        {
          error,
        },
        "Error sending SMS",
      );
      return {
        messageId: undefined,
      };
    }
  }
}
