import type { OrgSdkClients } from "../clients/create-sdk-clients.js";
import { extractSdkErrorDetail } from "../clients/sdk-error.js";
import type {
  LoadedConfig,
  Logger,
  ResolvedUser,
  SeedCommand,
} from "../domain/types.js";
import type { GeneratedPdf } from "../pdf/generate-pdfs.js";
import { generateMarkerPdfs } from "../pdf/generate-pdfs.js";
import { resolveUser } from "../resolve/resolve-user.js";

async function uploadPdf(
  clients: OrgSdkClients,
  pdf: GeneratedPdf,
): Promise<string> {
  const result = await clients.upload.uploadFile(pdf.file);
  if (result.error || result.data?.uploadId == null) {
    throw new Error(
      `uploadFile failed for ${pdf.fileName}: ${extractSdkErrorDetail(result.error ?? "no uploadId returned")}`,
    );
  }
  return result.data.uploadId;
}

async function shareFile(
  clients: OrgSdkClients,
  fileId: string,
  userId: string,
): Promise<void> {
  const result = await clients.upload.shareFile(fileId, userId);
  if (result.error) {
    throw new Error(
      `shareFile(${fileId} -> ${userId}) failed: ${extractSdkErrorDetail(result.error)}`,
    );
  }
}

async function sendMessageWithAttachment(params: {
  clients: OrgSdkClients;
  recipientUserId: string;
  subject: string;
  attachmentId: string;
}): Promise<string> {
  const { clients, recipientUserId, subject, attachmentId } = params;
  const nowIso = new Date().toISOString();

  const result = await clients.messaging.send({
    preferredTransports: ["email"],
    recipientUserId,
    security: "confidential",
    scheduleAt: nowIso,
    message: {
      subject,
      excerpt: subject,
      plainText: `${subject}. This message carries a legitimate attachment for its own recipient.`,
      language: "en",
    },
    attachments: [attachmentId],
  });

  if (result.error || result.data?.id == null) {
    throw new Error(
      `messaging.send to ${recipientUserId} failed: ${extractSdkErrorDetail(result.error ?? "no message id returned")}`,
    );
  }
  return result.data.id;
}

export async function runSeed(params: {
  config: LoadedConfig;
  command: SeedCommand;
  clients: OrgSdkClients;
  logger: Logger;
}): Promise<void> {
  const { config, command, clients, logger } = params;

  logger.info("[seed] Generating marker PDFs (user1 / user2).");
  const { pdfA, pdfB } = await generateMarkerPdfs();

  logger.info("[seed] Resolving target users.");
  const [user1, user2]: [ResolvedUser, ResolvedUser] = [
    await resolveUser({ profile: clients.profile, identifier: config.user1 }),
    await resolveUser({ profile: clients.profile, identifier: config.user2 }),
  ];
  logger.info("[seed] Resolved users.", {
    user1: { identifier: user1.identifier, profileId: user1.profileId },
    user2: { identifier: user2.identifier, profileId: user2.profileId },
  });

  logger.info("[seed] Uploading org-owned files.");
  const fileAId = await uploadPdf(clients, pdfA);
  const fileBId = await uploadPdf(clients, pdfB);
  logger.info("[seed] Uploaded files.", { fileAId, fileBId });

  // Legitimate ownership: each user gets their own file, shared + attached.
  logger.info("[seed] Seeding legitimate message for user1 (fileA).");
  await shareFile(clients, fileAId, user1.profileId);
  const messageAId = await sendMessageWithAttachment({
    clients,
    recipientUserId: user1.profileId,
    subject: "Repro export leak - user1 legitimate document",
    attachmentId: fileAId,
  });

  logger.info("[seed] Seeding legitimate message for user2 (fileB).");
  await shareFile(clients, fileBId, user2.profileId);
  const messageBId = await sendMessageWithAttachment({
    clients,
    recipientUserId: user2.profileId,
    subject: "Repro export leak - user2 legitimate document",
    attachmentId: fileBId,
  });

  // THE LEAK: share user2's file with user1 via files_users only, with NO
  // message send (so there is no attachments_messages row). A correct export
  // scopes files to the user's own message attachments; a buggy export that
  // reads every files_users share will include fileB in user1's export.
  logger.warn("[seed] Injecting cross-user leak share (fileB -> user1).");
  await shareFile(clients, fileBId, user1.profileId);

  const symmetricShare = command.symmetric
    ? { fileId: fileAId, userId: user1.profileId, recipient: user2 }
    : null;
  if (command.symmetric) {
    logger.warn("[seed] Injecting symmetric leak share (fileA -> user2).");
    await shareFile(clients, fileAId, user2.profileId);
  }

  printSummary({
    logger,
    environmentLabel: config.endpoints.environmentLabel,
    user1,
    user2,
    fileAId,
    fileBId,
    messageAId,
    messageBId,
    symmetric: command.symmetric,
    symmetricShare,
  });
}

function printSummary(params: {
  logger: Logger;
  environmentLabel: string;
  user1: ResolvedUser;
  user2: ResolvedUser;
  fileAId: string;
  fileBId: string;
  messageAId: string;
  messageBId: string;
  symmetric: boolean;
  symmetricShare: {
    fileId: string;
    userId: string;
    recipient: ResolvedUser;
  } | null;
}): void {
  const {
    logger,
    environmentLabel,
    user1,
    user2,
    fileAId,
    fileBId,
    messageAId,
    messageBId,
    symmetric,
    symmetricShare,
  } = params;

  const lines = [
    "",
    "==================== SEED SUMMARY ====================",
    `Environment       : ${environmentLabel}`,
    `user1             : ${user1.identifier} -> profileId ${user1.profileId} (via ${user1.resolvedVia})`,
    `user2             : ${user2.identifier} -> profileId ${user2.profileId} (via ${user2.resolvedVia})`,
    `fileA (user1)     : ${fileAId}  [belongs-to-user1.pdf]`,
    `fileB (user2)     : ${fileBId}  [belongs-to-user2.pdf]`,
    `message user1     : ${messageAId} (attachment fileA)`,
    `message user2     : ${messageBId} (attachment fileB)`,
    "",
    "INJECTED LEAK SHARE (record this for cleanup):",
    `  fileId=${fileBId} sharedWith userId=${user1.profileId}  (fileB -> user1, no message)`,
    symmetric && symmetricShare
      ? `  fileId=${symmetricShare.fileId} sharedWith userId=${symmetricShare.userId}  (fileA -> user2, no message)`
      : "  (symmetric leak not injected; pass --symmetric to add fileA -> user2)",
    "",
    "Next: log into the citizen portal as user1 (andrea), export your data, and",
    "      confirm the zip contains a belongs-to-user2 PDF (the leak) alongside",
    "      your own belongs-to-user1 PDF.",
    `Cleanup: run \`cleanup --file-id ${fileBId} --user-id ${user1.profileId} --yes\`.`,
    "=====================================================",
    "",
  ];

  logger.info(lines.join("\n"));
}
