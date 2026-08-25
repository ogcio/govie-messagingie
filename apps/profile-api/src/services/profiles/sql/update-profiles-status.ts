import { httpErrors } from "@fastify/sensible";
import type { PoolClient } from "pg";
import type { ProfileStatus } from "~/schemas/profiles/model.js";

export async function updateProfilesStatus(params: {
  client: PoolClient;
  profileIds: string[];
  statusToSet: ProfileStatus;
}): Promise<void> {
  const { client, profileIds, statusToSet } = params;

  if (profileIds.length === 0) {
    return;
  }

  const updated = await client.query(
    `
        UPDATE profiles
        SET status = $1,
            updated_at = now()
        WHERE id = ANY($2);
    `,
    [statusToSet, profileIds],
  );

  if (updated.rowCount !== profileIds.length) {
    throw httpErrors.badRequest(
      `Failed to update status for all profiles. Expected to update ${profileIds.length}, but updated ${updated.rowCount}`,
    );
  }
}
