import { describe, expect, it, vi } from "vitest";
import type {
  BatchRunStore,
  LoggerAdapter,
  MessagingClient,
} from "../../../scripts/send-message-batches/domain/types.js";
import { syncDeliverySnapshotsPhase } from "../../../scripts/send-message-batches/phases/sync-delivery-snapshots-phase.js";

function createLogger(): LoggerAdapter {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createOperatorOutput() {
  return {
    runStarted: vi.fn(),
    recipientsPhaseStarted: vi.fn(),
    recipientsPhaseCompleted: vi.fn(),
    sendPhaseStarted: vi.fn(),
    sendBatchCompleted: vi.fn(),
    sendPhaseCompleted: vi.fn(),
    deliverySyncPhaseStarted: vi.fn(),
    deliverySyncPhaseCompleted: vi.fn(),
    runCompleted: vi.fn(),
  };
}

describe("syncDeliverySnapshotsPhase", () => {
  it("stores only the latest delivery event for eligible messages", async () => {
    const store = {
      listMessagesEligibleForDeliverySync: vi
        .fn<BatchRunStore["listMessagesEligibleForDeliverySync"]>()
        .mockResolvedValue([
          { id: "message-1", externalMessageId: "external-1" },
        ]),
      markDeliverySyncAttempted: vi
        .fn<BatchRunStore["markDeliverySyncAttempted"]>()
        .mockResolvedValue(undefined),
      storeLatestDeliverySnapshot: vi
        .fn<BatchRunStore["storeLatestDeliverySnapshot"]>()
        .mockResolvedValue(undefined),
      countMessagesTooNewForDeliverySync: vi
        .fn<BatchRunStore["countMessagesTooNewForDeliverySync"]>()
        .mockResolvedValue(0),
    } satisfies Pick<
      BatchRunStore,
      | "listMessagesEligibleForDeliverySync"
      | "markDeliverySyncAttempted"
      | "storeLatestDeliverySnapshot"
      | "countMessagesTooNewForDeliverySync"
    >;

    const messagingClient = {
      getEventsForMessage: vi
        .fn<MessagingClient["getEventsForMessage"]>()
        .mockResolvedValue([
          {
            eventType: "delivered",
            eventStatus: "successful",
            eventPayload: { status: "old" },
            eventAt: new Date("2026-05-26T10:01:00.000Z"),
          },
          {
            eventType: "opened",
            eventStatus: "successful",
            eventPayload: { status: "latest" },
            eventAt: new Date("2026-05-26T10:02:00.000Z"),
          },
        ]),
    } satisfies Pick<MessagingClient, "getEventsForMessage">;

    const operatorOutput = createOperatorOutput();

    await syncDeliverySnapshotsPhase({
      runId: "run-1",
      store,
      messagingClient,
      logger: createLogger(),
      operatorOutput,
      eventSyncDelaySeconds: 0,
      now: new Date("2026-05-26T10:05:00.000Z"),
    });

    expect(store.storeLatestDeliverySnapshot).toHaveBeenCalledWith({
      messageId: "message-1",
      snapshot: {
        eventType: "opened",
        eventStatus: "successful",
        eventPayload: { status: "latest" },
        eventAt: new Date("2026-05-26T10:02:00.000Z"),
      },
      syncedAt: new Date("2026-05-26T10:05:00.000Z"),
    });

    expect(operatorOutput.deliverySyncPhaseStarted).toHaveBeenCalledWith({
      eligibleNow: 1,
      tooNewForSync: 0,
    });
    expect(operatorOutput.deliverySyncPhaseCompleted).toHaveBeenCalledWith({
      syncedSnapshots: 1,
      checkedWithoutSnapshot: 0,
      tooNewForSync: 0,
    });
  });

  it("leaves messages unsynced when the event API returns nothing", async () => {
    const store = {
      listMessagesEligibleForDeliverySync: vi
        .fn<BatchRunStore["listMessagesEligibleForDeliverySync"]>()
        .mockResolvedValue([
          { id: "message-1", externalMessageId: "external-1" },
        ]),
      markDeliverySyncAttempted: vi
        .fn<BatchRunStore["markDeliverySyncAttempted"]>()
        .mockResolvedValue(undefined),
      storeLatestDeliverySnapshot: vi
        .fn<BatchRunStore["storeLatestDeliverySnapshot"]>()
        .mockResolvedValue(undefined),
      countMessagesTooNewForDeliverySync: vi
        .fn<BatchRunStore["countMessagesTooNewForDeliverySync"]>()
        .mockResolvedValue(3),
    } satisfies Pick<
      BatchRunStore,
      | "listMessagesEligibleForDeliverySync"
      | "markDeliverySyncAttempted"
      | "storeLatestDeliverySnapshot"
      | "countMessagesTooNewForDeliverySync"
    >;

    const messagingClient = {
      getEventsForMessage: vi
        .fn<MessagingClient["getEventsForMessage"]>()
        .mockResolvedValue([]),
    } satisfies Pick<MessagingClient, "getEventsForMessage">;

    const operatorOutput = createOperatorOutput();

    await syncDeliverySnapshotsPhase({
      runId: "run-1",
      store,
      messagingClient,
      logger: createLogger(),
      operatorOutput,
      eventSyncDelaySeconds: 0,
      now: new Date("2026-05-26T10:05:00.000Z"),
    });

    expect(store.storeLatestDeliverySnapshot).not.toHaveBeenCalled();
    expect(store.markDeliverySyncAttempted).toHaveBeenCalledWith(
      "message-1",
      new Date("2026-05-26T10:05:00.000Z"),
    );

    expect(operatorOutput.deliverySyncPhaseStarted).toHaveBeenCalledWith({
      eligibleNow: 1,
      tooNewForSync: 3,
    });
    expect(operatorOutput.deliverySyncPhaseCompleted).toHaveBeenCalledWith({
      syncedSnapshots: 0,
      checkedWithoutSnapshot: 1,
      tooNewForSync: 3,
    });
  });
});
