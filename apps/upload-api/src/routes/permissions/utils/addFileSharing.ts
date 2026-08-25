import type { PostgresDb } from "@fastify/postgres";
import { httpErrors } from "@fastify/sensible";
import type { AddPermissionsRequestBody } from "../schema.js";

export default (pg: PostgresDb, params: AddPermissionsRequestBody) => {
  const fileId = params.fileId;
  let toAddUserIds: string[];
  if ("userIds" in params) {
    toAddUserIds = params.userIds;
  } else {
    toAddUserIds = [params.userId];
  }

  try {
    return pg.query(
      `
    INSERT INTO files_users (file_id, user_id)
    SELECT $1, unnest($2::text[])
    `,
      [fileId, toAddUserIds],
    );
  } catch (err) {
    throw httpErrors.createError(
      500,
      "Internal server error adding permissions",
      { parent: err },
    );
  }
};
