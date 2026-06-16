import { describe, expect, it, vi } from "vitest";
import type {
  BatchRunStore,
  LoggerAdapter,
  ProfileClient,
} from "../../../scripts/send-message-batches/domain/types.js";
import { resolveRecipientsPhase } from "../../../scripts/send-message-batches/phases/resolve-recipients-phase.js";

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

describe("resolveRecipientsPhase", () => {
  it("marks unresolved and duplicate recipients while creating one canonical message per profile", async () => {
    const store = {
      getRunSummary: vi
        .fn<BatchRunStore["getRunSummary"]>()
        .mockResolvedValueOnce({
          totalRecipients: 0,
        } as Awaited<ReturnType<BatchRunStore["getRunSummary"]>>)
        .mockResolvedValueOnce({
          totalRecipients: 3,
          resolvedRecipients: 1,
          duplicateRecipients: 1,
          unresolvedRecipients: 1,
          totalMessages: 1,
          pendingMessages: 0,
          sentMessages: 0,
          terminalSendFailureMessages: 0,
          messagesWithSnapshot: 0,
          successfulDeliveries: 0,
          failedDeliveries: 0,
          awaitingSnapshots: 0,
        } as Awaited<ReturnType<BatchRunStore["getRunSummary"]>>),
      insertRecipients: vi
        .fn<BatchRunStore["insertRecipients"]>()
        .mockResolvedValue(undefined),
      listPendingRecipients: vi
        .fn<BatchRunStore["listPendingRecipients"]>()
        .mockResolvedValue([
          {
            id: "recipient-1",
            csvRowNumber: 1,
            rawEmail: "one@example.com",
            normalizedEmail: "one@example.com",
          },
          {
            id: "recipient-2",
            csvRowNumber: 2,
            rawEmail: "dup@example.com",
            normalizedEmail: "dup@example.com",
          },
          {
            id: "recipient-3",
            csvRowNumber: 3,
            rawEmail: "none@example.com",
            normalizedEmail: "none@example.com",
          },
        ]),
      findCanonicalMessageByProfileId: vi
        .fn<BatchRunStore["findCanonicalMessageByProfileId"]>()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "message-1" }),
      createPendingMessage: vi
        .fn<BatchRunStore["createPendingMessage"]>()
        .mockResolvedValue({ id: "message-1" }),
      markRecipientResolved: vi
        .fn<BatchRunStore["markRecipientResolved"]>()
        .mockResolvedValue(undefined),
      markRecipientDuplicate: vi
        .fn<BatchRunStore["markRecipientDuplicate"]>()
        .mockResolvedValue(undefined),
      markRecipientUnresolved: vi
        .fn<BatchRunStore["markRecipientUnresolved"]>()
        .mockResolvedValue(undefined),
      listUnresolvedRecipientReasonCounts: vi
        .fn<BatchRunStore["listUnresolvedRecipientReasonCounts"]>()
        .mockResolvedValue([
          { label: "No profile match returned by findProfile", count: 1 },
        ]),
    } satisfies Pick<
      BatchRunStore,
      | "getRunSummary"
      | "insertRecipients"
      | "listPendingRecipients"
      | "findCanonicalMessageByProfileId"
      | "createPendingMessage"
      | "markRecipientResolved"
      | "markRecipientDuplicate"
      | "markRecipientUnresolved"
      | "listUnresolvedRecipientReasonCounts"
    >;

    const profileClient = {
      findProfile: vi
        .fn<ProfileClient["findProfile"]>()
        .mockResolvedValueOnce([
          {
            profileId: "profile-1",
            publicName: "One",
            email: "one@example.com",
            consentStatus: "opted-in",
            profileStatus: "active",
          },
        ])
        .mockResolvedValueOnce([
          {
            profileId: "profile-1",
            publicName: "One",
            email: "dup@example.com",
            consentStatus: "opted-in",
            profileStatus: "active",
          },
        ])
        .mockResolvedValueOnce([]),
    } satisfies Pick<ProfileClient, "findProfile">;

    const readRecipientCsv = vi.fn().mockResolvedValue([
      {
        csvRowNumber: 1,
        rawEmail: "one@example.com",
        normalizedEmail: "one@example.com",
      },
      {
        csvRowNumber: 2,
        rawEmail: "dup@example.com",
        normalizedEmail: "dup@example.com",
      },
      {
        csvRowNumber: 3,
        rawEmail: "none@example.com",
        normalizedEmail: "none@example.com",
      },
    ]);

    const operatorOutput = createOperatorOutput();

    await resolveRecipientsPhase({
      runId: "run-1",
      store,
      profileClient,
      logger: createLogger(),
      operatorOutput,
      recipientsCsvPath: "/tmp/recipients.csv",
      readRecipientCsv,
      scheduleAt: new Date("2026-05-26T10:00:00.000Z"),
    });

    expect(store.insertRecipients).toHaveBeenCalledTimes(1);
    expect(store.createPendingMessage).toHaveBeenCalledTimes(1);
    expect(store.markRecipientDuplicate).toHaveBeenCalledWith({
      recipientId: "recipient-2",
      canonicalMessageId: "message-1",
      profileId: "profile-1",
      publicName: "One",
      profileEmail: "dup@example.com",
      consentStatus: "opted-in",
      profileStatus: "active",
    });
    expect(store.markRecipientUnresolved).toHaveBeenCalledWith({
      recipientId: "recipient-3",
      reason: "No profile match returned by findProfile",
    });

    expect(operatorOutput.recipientsPhaseStarted).toHaveBeenCalledWith({
      recipientsCsvPath: "/tmp/recipients.csv",
    });
    expect(operatorOutput.recipientsPhaseCompleted).toHaveBeenCalledWith({
      totalCsvRows: 3,
      resolvedRecipients: 1,
      duplicateRecipients: 1,
      unresolvedRecipientReasons: [
        { label: "No profile match returned by findProfile", count: 1 },
      ],
      canonicalMessagesCreated: 1,
    });
  });

  it("rejects inactive or non-consenting matches", async () => {
    const store = {
      getRunSummary: vi
        .fn<BatchRunStore["getRunSummary"]>()
        .mockResolvedValueOnce({
          totalRecipients: 1,
        } as Awaited<ReturnType<BatchRunStore["getRunSummary"]>>)
        .mockResolvedValueOnce({
          totalRecipients: 1,
          resolvedRecipients: 0,
          duplicateRecipients: 0,
          unresolvedRecipients: 1,
          totalMessages: 0,
          pendingMessages: 0,
          sentMessages: 0,
          terminalSendFailureMessages: 0,
          messagesWithSnapshot: 0,
          successfulDeliveries: 0,
          failedDeliveries: 0,
          awaitingSnapshots: 0,
        } as Awaited<ReturnType<BatchRunStore["getRunSummary"]>>),
      insertRecipients: vi
        .fn<BatchRunStore["insertRecipients"]>()
        .mockResolvedValue(undefined),
      listPendingRecipients: vi
        .fn<BatchRunStore["listPendingRecipients"]>()
        .mockResolvedValue([
          {
            id: "recipient-1",
            csvRowNumber: 1,
            rawEmail: "one@example.com",
            normalizedEmail: "one@example.com",
          },
        ]),
      findCanonicalMessageByProfileId:
        vi.fn<BatchRunStore["findCanonicalMessageByProfileId"]>(),
      createPendingMessage: vi.fn<BatchRunStore["createPendingMessage"]>(),
      markRecipientResolved: vi
        .fn<BatchRunStore["markRecipientResolved"]>()
        .mockResolvedValue(undefined),
      markRecipientDuplicate: vi
        .fn<BatchRunStore["markRecipientDuplicate"]>()
        .mockResolvedValue(undefined),
      markRecipientUnresolved: vi
        .fn<BatchRunStore["markRecipientUnresolved"]>()
        .mockResolvedValue(undefined),
      listUnresolvedRecipientReasonCounts: vi
        .fn<BatchRunStore["listUnresolvedRecipientReasonCounts"]>()
        .mockResolvedValue([
          { label: "Profile is not eligible for messaging", count: 1 },
        ]),
    } satisfies Pick<
      BatchRunStore,
      | "getRunSummary"
      | "insertRecipients"
      | "listPendingRecipients"
      | "findCanonicalMessageByProfileId"
      | "createPendingMessage"
      | "markRecipientResolved"
      | "markRecipientDuplicate"
      | "markRecipientUnresolved"
      | "listUnresolvedRecipientReasonCounts"
    >;

    const profileClient = {
      findProfile: vi.fn<ProfileClient["findProfile"]>().mockResolvedValue([
        {
          profileId: "profile-1",
          publicName: "One",
          email: "one@example.com",
          consentStatus: "opted-out",
          profileStatus: "active",
        },
      ]),
    } satisfies Pick<ProfileClient, "findProfile">;

    await resolveRecipientsPhase({
      runId: "run-1",
      store,
      profileClient,
      logger: createLogger(),
      operatorOutput: createOperatorOutput(),
      recipientsCsvPath: "/tmp/recipients.csv",
      readRecipientCsv: vi.fn().mockResolvedValue([]),
      scheduleAt: new Date("2026-05-26T10:00:00.000Z"),
    });

    expect(store.insertRecipients).not.toHaveBeenCalled();
    expect(store.createPendingMessage).not.toHaveBeenCalled();
    expect(store.markRecipientUnresolved).toHaveBeenCalledWith({
      recipientId: "recipient-1",
      reason: "Profile is not eligible for messaging",
      profileId: "profile-1",
      publicName: "One",
      profileEmail: "one@example.com",
      consentStatus: "opted-out",
      profileStatus: "active",
    });
  });
});
