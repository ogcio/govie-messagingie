import type { Messaging } from "@ogcio/building-blocks-sdk/dist/types/index.js";
import type pino from "pino";

type SearchMessagesResponse = Awaited<
  ReturnType<Messaging["support"]["postMessagesSearch"]>
>;
type MessageItem = NonNullable<SearchMessagesResponse["data"]>[number];

export async function getMessagesForUsers(params: {
  userIds: string[];
  messagingSupportSdk: Messaging["support"];
  logger: pino.Logger;
}): Promise<
  | { success: true; data: Record<string, MessageItem[]> }
  | { success: false; error: Error }
> {
  const { userIds, messagingSupportSdk, logger } = params;

  const pageSize = 10;
  const userIdBatchSize = 10;
  const messagesPerUser: Record<string, MessageItem[]> = {};

  const userIdBatches: string[][] = [];
  for (let i = 0; i < userIds.length; i += userIdBatchSize) {
    userIdBatches.push(userIds.slice(i, i + userIdBatchSize));
  }

  for (const userIdBatch of userIdBatches) {
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await messagingSupportSdk.postMessagesSearch(
        { limit: String(pageSize), offset: String(offset) },
        { recipientUserIds: userIdBatch },
      );

      if (response.error || !response.data) {
        logger.error(
          { error: response.error },
          `Failed to fetch messages for users ${userIdBatch.join(", ")}`,
        );
        return {
          success: false,
          error: new Error(
            `Failed to fetch messages for users ${userIdBatch.join(", ")}`,
          ),
        };
      }

      for (const message of response.data) {
        if (!messagesPerUser[message.recipientUserId]) {
          messagesPerUser[message.recipientUserId] = [];
        }
        messagesPerUser[message.recipientUserId].push(message);
      }

      if ((response.metadata?.totalCount ?? 0) <= offset + pageSize) {
        hasMore = false;
      } else {
        offset += pageSize;
      }
    }
  }

  return { success: true, data: messagesPerUser };
}

export function getAttachmentFileIdsByUserId(
  messagesByUserId: Record<string, MessageItem[]>,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [userId, messages] of Object.entries(messagesByUserId)) {
    const fileIds = new Set<string>();
    for (const message of messages) {
      for (const fileId of message.attachmentIds ?? []) fileIds.add(fileId);
    }
    if (fileIds.size > 0) result[userId] = Array.from(fileIds);
  }
  return result;
}

export function buildExportSucceededMessageContent(params: {
  publicName: string;
}): {
  subject: string;
  plainText: string;
  richText: string;
} {
  const { publicName } = params;

  const plainText = `Hi ${publicName},
          Your MessagingIE data export is ready.
          You can download your MessagingIE and profile data by visiting your profile settings. Your export will be available to download for 30 days, so we recommend saving it at your earliest convenience.
          If you did not request this export, or if you have any questions, please contact us at https://profile.services.gov.ie/en/contact-support
          Thanks,
          The MessagingIE Team
          
          --------------------------------------------------------------

          Dia duit ${publicName},
          Tá easpórtáil do shonraí MessagingIE réidh.
          Is féidir leat do chuid sonraí MessagingIE agus próifíle a íoslódáil trí chuairt a thabhairt ar do shocruithe próifíle. Beidh d'easpórtáil ar fáil le híoslódáil ar feadh 30 lá, mar sin molaimid í a shábháil ar do chaoithiúlacht is luaithe.
          Murar iarr tú an t-onnmhairiú seo, nó má tá aon cheist agat, déan teagmháil linn ag https://profile.services.gov.ie/en/contact-support
          Go raibh maith agat,
          Foireann MessagingIE`;

  const richText = `<p>Hi ${publicName},</p>
          <p>Your MessagingIE data export is ready.</p>
          <p>You can download your MessagingIE and profile data by visiting your profile settings. Your export will be available to download for 30 days, so we recommend saving it at your earliest convenience.</p>
          <p>If you did not request this export, or if you have any questions, please contact us at <a href="https://profile.services.gov.ie/en/contact-support">https://profile.services.gov.ie/en/contact-support</a></p>
          <p>Thanks,<br/>The MessagingIE Team</p>
          
          <hr/>

          <p>Dia duit ${publicName},</p>
          <p>Tá easpórtáil do shonraí MessagingIE réidh.</p>
          <p>Is féidir leat do chuid sonraí MessagingIE agus próifíle a íoslódáil trí chuairt a thabhairt ar do shocruithe próifíle. Beidh d'easpórtáil ar fáil le híoslódáil ar feadh 30 lá, mar sin molaimid í a shábháil ar do chaoithiúlacht is luaithe.</p>
          <p>Murar iarr tú an t-onnmhairiú seo, nó má tá aon cheist agat, déan teagmháil linn ag <a href="https://profile.services.gov.ie/en/contact-support">https://profile.services.gov.ie/en/contact-support</a></p>
          <p>Go raibh maith agat,</p>
          <p>Foireann MessagingIE</p>`;

  return {
    subject: "Your MessagingIE Data Export is Ready",
    plainText,
    richText,
  };
}

export async function sendPublicMessage(params: {
  profile: { id: string; preferredLanguage?: "en" | "ga" };
  messagingSupportSdk: Messaging["support"];
  logger: pino.Logger;
  message: {
    plainText: string;
    richText: string;
    subject: string;
  };
}): Promise<
  { success: true; messageId: string } | { success: false; error: string }
> {
  const { profile, messagingSupportSdk, logger } = params;

  logger.info({ recipientUserId: profile.id }, "Sending message to user");
  let messageSendResult:
    | undefined
    | Awaited<ReturnType<Messaging["support"]["send"]>>;
  try {
    messageSendResult = await messagingSupportSdk.send({
      recipientUserId: profile.id,
      message: {
        plainText: params.message.plainText,
        richText: params.message.richText,
        subject: params.message.subject,
        language: profile.preferredLanguage || "en",
      },
      preferredTransports: ["email"],
      scheduleAt: new Date().toISOString(),
      security: "public",
    });
  } catch (error) {
    logger.error(
      { error, recipientUserId: profile.id },
      "Failed to send export succeeded message to user, thrown exception",
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  if (messageSendResult === undefined) {
    logger.warn(
      { recipientUserId: profile.id },
      "Failed to send export succeeded message to user, no result returned",
    );
    return {
      success: false,
      error: "No result returned from message send operation",
    };
  }

  if (messageSendResult.error || !messageSendResult.data) {
    logger.error(
      { error: messageSendResult.error, recipientUserId: profile.id },
      "Failed to send export succeeded message to user, error in response",
    );
    return {
      success: false,
      error: messageSendResult.error
        ? messageSendResult.error.detail
        : "Unknown error",
    };
  }

  return { success: true, messageId: messageSendResult.data.id };
}
