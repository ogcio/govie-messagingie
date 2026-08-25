import type fastifyPostgres from "@fastify/postgres";
import type {
  FastifyBaseLogger,
  FastifyInstance,
  FastifyRequest,
} from "fastify";
import { PersonalProfileSdkWrapper } from "../../utils/personal-profile-sdk-wrapper.js";

export default async (
  app: FastifyInstance,
  request: FastifyRequest,
  fileId: string,
): Promise<void> => {
  const canAccessFile = request.userData
    ? await canUserAccessFile(
        app.pg,
        fileId,
        {
          ...request.userData,
          organizationId: request.userData.organizationId,
        },
        request.log,
      )
    : false;

  if (!canAccessFile) {
    throw app.httpErrors.forbidden("User cannot access this file");
  }
};

async function canUserAccessFile(
  pg: fastifyPostgres.PostgresDb,
  fileId: string,
  userData: {
    userId: string;
    organizationId: string | undefined;
    accessToken: string;
  },
  logger: FastifyBaseLogger,
): Promise<boolean> {
  // If it is a public servant check if the file
  // is owned by the org
  if (userData.organizationId) {
    const owner = await pg.query<{ id: string }>(
      `
    SELECT id FROM files
    WHERE organization_id = $1 and id = $2 LIMIT 1
    `,
      [userData.organizationId, fileId],
    );
    if (owner.rowCount && owner.rowCount > 0) {
      return true;
    }
  }
  // Otherwise check if the file has been shared with the user
  const sharedWith = await pg.query<{ id: string }>(
    `
    SELECT user_id FROM files_users
    WHERE file_id = $1 and user_id = $2 LIMIT 1
  `,
    [fileId, userData.userId],
  );

  if (sharedWith.rowCount && sharedWith.rowCount > 0) {
    return true;
  }

  const profileSdk = new PersonalProfileSdkWrapper(logger, userData);
  const linkedProfilesIds = await profileSdk.getLinkedProfileIds(
    userData.userId,
  );

  // Otherwise check if the file has been shared with the user
  const sharedWithMany = await pg.query<{ id: string }>(
    `
    SELECT user_id FROM files_users
    WHERE file_id = $1 and user_id = ANY($2) LIMIT 1
  `,
    [fileId, linkedProfilesIds],
  );
  if (sharedWithMany.rowCount && sharedWithMany.rowCount > 0) {
    return true;
  }

  return false;
}
