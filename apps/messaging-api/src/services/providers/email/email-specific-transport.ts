import { createTransport, type Transporter } from "nodemailer";
import type { Headers } from "nodemailer/lib/mailer/index.js";
import type { MessageToDeliver } from "../../../types/messages.js";
import type { EmailProvider } from "../../../types/providers.js";
import {
  type EventType,
  type MessageEventData,
  MessagingEventType,
} from "../../messages/event-logger.js";

export class EmailSpecificTransport {
  readonly provider: EmailProvider;
  private nodeMailerTransporter: Transporter | undefined;

  constructor(provider: EmailProvider) {
    this.provider = provider;
  }

  async sendMessage(params: {
    message: MessageToDeliver;
    recipientAddress: string;
  }) {
    const { recipientAddress, message } = params;
    const transporter = await this.getNodemailerTransporter();

    const headers: Headers | undefined = this.provider.headers ?? undefined;

    await transporter.sendMail({
      from: `${this.provider.providerName} <${this.provider.fromAddress}>`,
      to: recipientAddress,
      subject: message.subject,
      text: message.body,
      html: message.richText,
      headers,
    });
  }

  private async getNodemailerTransporter(): Promise<Transporter> {
    if (this.nodeMailerTransporter) {
      return this.nodeMailerTransporter;
    }

    this.nodeMailerTransporter = createTransport({
      host: this.provider.smtpHost,
      port: this.provider.smtpPort,
      secure: this.provider.ssl,
      auth: {
        user: this.provider.username,
        pass: this.provider.password,
      },
    });

    return this.nodeMailerTransporter;
  }

  async checkIfMessageCanBeSent(params: {
    message: MessageToDeliver;
    userAddress: string | null | undefined;
  }): Promise<{
    canBeSent: boolean;
    eventToLog?: { type: EventType; eventData: MessageEventData };
  }> {
    const { message, userAddress } = params;
    if (!userAddress || userAddress.trim().length === 0) {
      return {
        canBeSent: false,
        eventToLog: {
          type: MessagingEventType.emailError,
          eventData: {
            messageId: message.id,
            messageKey: "noEmail",
          },
        },
      };
    }
    if (!message.subject || message.subject.trim().length === 0) {
      return {
        canBeSent: false,
        eventToLog: {
          type: MessagingEventType.emailError,
          eventData: {
            messageId: message.id,
            messageKey: "noSubject",
          },
        },
      };
    }

    return { canBeSent: true };
  }
}
