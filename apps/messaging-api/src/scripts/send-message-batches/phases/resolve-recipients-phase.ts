import { readRecipientCsv } from "../csv/read-recipient-csv.js";
import type {
  BatchRunStore,
  LoggerAdapter,
  ProfileClient,
} from "../domain/types.js";
import type { OperatorOutput } from "../logging/operator-output.js";

const ELIGIBLE_CONSENT_STATUSES = new Set(["opted-in", "pre-approved"]);

function isEligible(profile: {
  consentStatus: string | null;
  profileStatus: string | null;
}): boolean {
  return (
    profile.profileStatus === "active" &&
    ELIGIBLE_CONSENT_STATUSES.has(profile.consentStatus ?? "")
  );
}

export async function resolveRecipientsPhase(params: {
  runId: string;
  store: Pick<
    BatchRunStore,
    | "getRunSummary"
    | "insertRecipients"
    | "listPendingRecipients"
    | "findCanonicalMessageByProfileId"
    | "createPendingMessage"
    | "markRecipientResolved"
    | "markRecipientUnresolved"
    | "markRecipientDuplicate"
    | "listUnresolvedRecipientReasonCounts"
  >;
  profileClient: Pick<ProfileClient, "findProfile">;
  logger: LoggerAdapter;
  operatorOutput: OperatorOutput;
  recipientsCsvPath: string;
  readRecipientCsv?: typeof readRecipientCsv;
  scheduleAt: Date;
}): Promise<void> {
  const readRecipientCsvFn = params.readRecipientCsv ?? readRecipientCsv;

  params.operatorOutput.recipientsPhaseStarted({
    recipientsCsvPath: params.recipientsCsvPath,
  });

  const summary = await params.store.getRunSummary(params.runId);

  if (summary != null && summary.totalRecipients === 0) {
    const recipients = await readRecipientCsvFn(params.recipientsCsvPath);
    await params.store.insertRecipients(params.runId, recipients);
  }

  const pendingRecipients = await params.store.listPendingRecipients(
    params.runId,
  );

  for (const recipient of pendingRecipients) {
    const matches = await params.profileClient.findProfile(
      recipient.normalizedEmail,
    );
    const profile = matches[0];

    if (profile == null) {
      await params.store.markRecipientUnresolved({
        recipientId: recipient.id,
        reason: "No profile match returned by findProfile",
      });
      continue;
    }

    if (!isEligible(profile)) {
      await params.store.markRecipientUnresolved({
        recipientId: recipient.id,
        reason: "Profile is not eligible for messaging",
        profileId: profile.profileId,
        publicName: profile.publicName,
        profileEmail: profile.email,
        consentStatus: profile.consentStatus,
        profileStatus: profile.profileStatus,
      });
      continue;
    }

    const existingMessage = await params.store.findCanonicalMessageByProfileId(
      params.runId,
      profile.profileId,
    );

    if (existingMessage != null) {
      await params.store.markRecipientDuplicate({
        recipientId: recipient.id,
        canonicalMessageId: existingMessage.id,
        profileId: profile.profileId,
        publicName: profile.publicName,
        profileEmail: profile.email,
        consentStatus: profile.consentStatus,
        profileStatus: profile.profileStatus,
      });
      continue;
    }

    const createdMessage = await params.store.createPendingMessage({
      runId: params.runId,
      sourceRecipientId: recipient.id,
      profileId: profile.profileId,
      recipientEmail: profile.email,
      templatePublicName: profile.publicName,
      templateEmail: profile.email,
      scheduleAt: params.scheduleAt,
    });

    await params.store.markRecipientResolved({
      recipientId: recipient.id,
      profileId: profile.profileId,
      publicName: profile.publicName,
      profileEmail: profile.email,
      consentStatus: profile.consentStatus,
      profileStatus: profile.profileStatus,
      canonicalMessageId: createdMessage.id,
    });

    params.logger.debug(
      {
        runId: params.runId,
        recipientId: recipient.id,
        profileId: profile.profileId,
        canonicalMessageId: createdMessage.id,
      },
      "Resolved recipient into canonical message",
    );
  }

  const finalSummary = await params.store.getRunSummary(params.runId);

  if (finalSummary != null) {
    params.operatorOutput.recipientsPhaseCompleted({
      totalCsvRows: finalSummary.totalRecipients,
      resolvedRecipients: finalSummary.resolvedRecipients,
      duplicateRecipients: finalSummary.duplicateRecipients,
      unresolvedRecipientReasons:
        await params.store.listUnresolvedRecipientReasonCounts(params.runId),
      canonicalMessagesCreated: finalSummary.totalMessages,
    });
  }
}
