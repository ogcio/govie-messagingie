import { httpErrors } from "@fastify/sensible";
import type { FastifyBaseLogger } from "fastify";
import { getM2MUploadSdk } from "../../utils/authentication-factory.js";

export async function ensureUserCanAccessAttachments(params: {
  userProfileId: string;
  attachmentIds: string[];
  organizationId: string;
  logger: FastifyBaseLogger;
}): Promise<undefined> {
  if (params.attachmentIds.length === 0) {
    return;
  }

  const uploadClient = await getM2MUploadSdk(
    params.logger,
    params.organizationId,
  );
  // this is request for upload/metadata. It will use m2m app for userData, and put userporfileid as ?user_id=..
  const sharedFiles = await uploadClient.getSharedFilesForUser(
    params.userProfileId,
    params.organizationId,
  );

  if (sharedFiles.error || !sharedFiles.data) {
    let message = "Error retrieving shared files";
    message += sharedFiles.error ? `: ${sharedFiles.error.detail}` : "";
    throw httpErrors.createError(503, message, { parent: sharedFiles.error });
  }

  const sharedFileIds: { [id: string]: string } = {};
  for (const shared of sharedFiles.data) {
    if (shared.id) {
      sharedFileIds[shared.id] = shared.id;
    }
  }

  for (const toSendAttachmentId of params.attachmentIds) {
    if (!(toSendAttachmentId in sharedFileIds)) {
      throw httpErrors.badRequest(
        `The attachment with id ${toSendAttachmentId} is not shared with the user with profile id ${params.userProfileId} for this organization`,
      );
    }
  }
}
