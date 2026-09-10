import { httpErrors } from "@fastify/sensible";
import type { PoolClient } from "pg";
import type {
  KnownProfileDataDetails,
  ProfileImportDetail,
} from "~/schemas/profiles/model.js";

const isValidProfileData = (data: unknown): data is KnownProfileDataDetails => {
  if (typeof data !== "object" || data === null) return false;
  const profile = data as Record<string, unknown>;
  return (
    typeof profile.firstName === "string" &&
    typeof profile.lastName === "string" &&
    typeof profile.email === "string"
  );
};

export const getProfileImportDetails = async (
  client: PoolClient,
  id: string,
  batch?: number,
  organisationId?: string,
): Promise<ProfileImportDetail[]> => {
  if (!id) {
    throw httpErrors.badRequest("Profile import ID is required");
  }
  const args: (string | number)[] = [id];
  const filters: string[] = [
    "pid.profile_import_id = $1",
    "pid.data IS NOT NULL",
  ];

  if (batch !== undefined) {
    args.push(batch);
    filters.push(`pid.batch_number = $${args.length}`);
  }

  if (organisationId !== undefined) {
    args.push(organisationId);
    filters.push(`pi.organisation_id = $${args.length}`);
  }

  const result = await client.query<{
    id: string;
    data: unknown;
    status: string;
    batch: number;
  }>(
    `SELECT pid.id, pid.data, pid.status, pid.batch_number as batch
    FROM profile_import_details pid
    INNER JOIN profile_imports pi ON pi.id = pid.profile_import_id
    WHERE ${filters.join(" AND ")}
    ORDER BY pid.id;`,
    args,
  );

  if (result.rows.length === 0) {
    throw httpErrors.notFound(`No import details found for import ID: ${id}`);
  }

  return result.rows.map((row) => {
    if (!isValidProfileData(row.data)) {
      throw httpErrors.badRequest("Invalid profile data format");
    }

    return { id: row.id, ...row.data, status: row.status, batch: row.batch };
  });
};
