import type {
  BatchRunStore,
  LoggerAdapter,
  MessagingClient,
} from "../domain/types.js";
import type { OperatorOutput } from "../logging/operator-output.js";
import { buildMessageContent } from "../template/build-message-content.js";

export async function sendMessagesPhase(params: {
  runId: string;
  store: Pick<
    BatchRunStore,
    "listPendingMessages" | "markMessageSent" | "markMessageTerminalFailure"
  >;
  messagingClient: Pick<MessagingClient, "sendMessage">;
  logger: LoggerAdapter;
  operatorOutput: OperatorOutput;
  subject: string;
  htmlTemplate: string;
  txtTemplate: string;
  sendBatchSize: number;
  sendBatchDelayMs: number;
  sleep: (delayMs: number) => Promise<void>;
}): Promise<void> {
  const pendingMessages = await params.store.listPendingMessages(params.runId);

  const batchCount = Math.ceil(pendingMessages.length / params.sendBatchSize);
  let sentCount = 0;
  let terminalFailureCount = 0;

  params.operatorOutput.sendPhaseStarted({
    totalMessages: pendingMessages.length,
    sendBatchSize: params.sendBatchSize,
    sendBatchDelayMs: params.sendBatchDelayMs,
  });

  for (
    let startIndex = 0;
    startIndex < pendingMessages.length;
    startIndex += params.sendBatchSize
  ) {
    const batch = pendingMessages.slice(
      startIndex,
      startIndex + params.sendBatchSize,
    );

    for (const message of batch) {
      try {
        const content = buildMessageContent({
          subject: params.subject,
          htmlTemplate: params.htmlTemplate,
          txtTemplate: params.txtTemplate,
          variables: {
            publicName: message.templatePublicName,
            email: message.templateEmail,
          },
        });

        const response = await params.messagingClient.sendMessage({
          recipientProfileId: message.profileId,
          recipientEmail: message.recipientEmail,
          scheduleAt: message.scheduleAt,
          content,
        });

        await params.store.markMessageSent({
          messageId: message.id,
          externalMessageId: response.messageId,
          renderedSubject: content.subject,
          renderedPlainText: content.plainText,
          renderedRichText: content.richText,
        });

        sentCount++;

        params.logger.debug(
          {
            runId: params.runId,
            messageId: message.id,
            externalMessageId: response.messageId,
          },
          "Sent canonical message",
        );
      } catch (error) {
        const sendError =
          error instanceof Error ? error.message : String(error);

        await params.store.markMessageTerminalFailure(message.id, sendError);
        terminalFailureCount++;
        params.logger.warn(
          {
            runId: params.runId,
            messageId: message.id,
            sendError,
          },
          "Message send failed without retry",
        );
      }
    }

    if (
      params.sendBatchDelayMs > 0 &&
      startIndex + batch.length < pendingMessages.length
    ) {
      await params.sleep(params.sendBatchDelayMs);
    }

    params.operatorOutput.sendBatchCompleted({
      batchIndex: Math.floor(startIndex / params.sendBatchSize) + 1,
      batchCount,
      sentCount,
      terminalFailureCount,
      remainingCount: pendingMessages.length - sentCount - terminalFailureCount,
    });
  }

  params.operatorOutput.sendPhaseCompleted({
    totalMessages: pendingMessages.length,
    sentCount,
    terminalFailureCount,
  });
}
