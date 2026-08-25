import { httpErrors } from "@fastify/sensible";
import type { Pool, PoolClient } from "pg";
import { LifecycleTaskTypes } from "~/schemas/data-lifecycle-tasks/index.js";
import { ProfileStatuses } from "~/schemas/profiles/model.js";
import { withClient } from "~/utils/with-client.js";
import { withRollback } from "~/utils/with-rollback.js";
import {
  createLifecycleTask,
  throwIfActiveTaskAlreadyExists,
} from "../data-lifecycle-tasks/create-task.js";
import { getProfile } from "../profiles/get-profile.js";
import { updateProfilesStatus } from "../profiles/sql/update-profiles-status.js";

const GRACE_PERIOD_MS = 0; // No grace period for now

export async function createDeleteProfileTask(params: {
  pool: Pool;
  toDeleteProfileId: string;
  requesterUserId: string | null;
  requesterApplicationId: string | null;
}): Promise<string> {
  return withClient(params.pool, async (client) => {
    const profileData = await ensureProfileCanBeDeleted(
      client,
      params.toDeleteProfileId,
    );

    await throwIfActiveTaskAlreadyExists({
      client,
      lifecycleTaskInput: {
        profile_id: profileData.id,
        task_type: LifecycleTaskTypes.DeleteProfile,
      },
    });

    return withRollback(client, async (client) => {
      await updateProfilesStatus({
        client,
        profileIds: [profileData.id, ...profileData.linkedProfileIds],
        statusToSet: ProfileStatuses.Disabled,
      });
      const scheduledAt = new Date(Date.now() + GRACE_PERIOD_MS).toISOString();

      const taskId = await createLifecycleTask({
        client,
        lifecycleTaskInput: {
          task_type: LifecycleTaskTypes.DeleteProfile,
          profile_id: profileData.id,
          scheduled_at: scheduledAt,
          metadata: {},
          requester_application_id: params.requesterApplicationId,
          requester_user_id: params.requesterUserId,
        },
      });

      return taskId.id;
    });
  });
}

async function ensureProfileCanBeDeleted(
  client: PoolClient,
  profileId: string,
): Promise<{ id: string; linkedProfileIds: string[] }> {
  const profile = await getProfile({
    client,
    profileId,
    organizationId: undefined,
    addLinkedProfiles: true,
    consentSubjects: [],
  });

  if (profile.id !== profile.primaryUserId) {
    throw httpErrors.badRequest("Only primary profiles can be deleted");
  }

  if (profile.status !== ProfileStatuses.Active) {
    throw httpErrors.badRequest(
      "Profile is already planned for deletion or disabled",
    );
  }

  return {
    id: profile.id,
    linkedProfileIds: profile.linkedProfiles?.map((lp) => lp.id) ?? [],
  };
}
