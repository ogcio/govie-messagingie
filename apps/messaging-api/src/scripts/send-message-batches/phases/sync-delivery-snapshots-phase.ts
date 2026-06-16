import type {
  BatchRunStore,
  DeliveryEvent,
  LoggerAdapter,
  MessagingClient,
} from "../domain/types.js";
import type { OperatorOutput } from "../logging/operator-output.js";

function getLatestEvent(events: DeliveryEvent[]): DeliveryEvent | null {
  if (events.length === 0) {
    return null;
  }

  return events.reduce((latest, current) =>
    current.eventAt.valueOf() > latest.eventAt.valueOf() ? current : latest,
  );
}

export async function syncDeliverySnapshotsPhase(params: {
  runId: string;
  store: Pick<
    BatchRunStore,
    | "listMessagesEligibleForDeliverySync"
    | "markDeliverySyncAttempted"
    | "storeLatestDeliverySnapshot"
    | "countMessagesTooNewForDeliverySync"
  >;
  messagingClient: Pick<MessagingClient, "getEventsForMessage">;
  logger: LoggerAdapter;
  operatorOutput: OperatorOutput;
  eventSyncDelaySeconds: number;
  now: Date;
}): Promise<void> {
  const eligibleMessages =
    await params.store.listMessagesEligibleForDeliverySync(
      params.runId,
      params.eventSyncDelaySeconds,
      params.now,
    );

  const tooNewForSync = await params.store.countMessagesTooNewForDeliverySync(
    params.runId,
    params.eventSyncDelaySeconds,
    params.now,
  );

  let syncedSnapshots = 0;
  let checkedWithoutSnapshot = 0;

  params.operatorOutput.deliverySyncPhaseStarted({
    eligibleNow: eligibleMessages.length,
    tooNewForSync,
  });

  for (const message of eligibleMessages) {
    const events = await params.messagingClient.getEventsForMessage(
      message.externalMessageId,
    );

    await params.store.markDeliverySyncAttempted(message.id, params.now);

    const snapshot = getLatestEvent(events);

    if (snapshot == null) {
      checkedWithoutSnapshot++;
      continue;
    }

    await params.store.storeLatestDeliverySnapshot({
      messageId: message.id,
      snapshot,
      syncedAt: params.now,
    });

    syncedSnapshots++;

    params.logger.debug(
      {
        runId: params.runId,
        messageId: message.id,
        eventType: snapshot.eventType,
      },
      "Stored latest delivery snapshot",
    );
  }

  params.operatorOutput.deliverySyncPhaseCompleted({
    syncedSnapshots,
    checkedWithoutSnapshot,
    tooNewForSync,
  });
}
