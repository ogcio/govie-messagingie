import dayjs from "dayjs";
import type { Pool } from "pg";
import {
  LifecycleTaskStatuses,
  LifecycleTaskTypes,
} from "~/schemas/data-lifecycle-tasks/index.js";
import { createLifecycleTask } from "./create-task.js";

export async function resetExportDataState({
  profileId,
  requesterUserId,
  requesterApplicationId,
  scheduledAt,
  pool,
  allowOverride,
}: {
  profileId: string;
  requesterUserId: string | null;
  requesterApplicationId: string | null;
  scheduledAt: string;
  pool: Pool;
  allowOverride: boolean;
}): Promise<string> {
  const client = await pool.connect();
  const { Pending } = LifecycleTaskStatuses;
  const nextExpiresAt = dayjs(scheduledAt).add(30, "days");
  const metadata = { expiresAt: nextExpiresAt.toISOString() };
  try {
    await client.query("BEGIN");

    const expireQueryResult = await client.query<{
      expires_at: string;
      status: string;
    }>(
      `
        SELECT 
            (metadata ->> 'expiresAt')::timestamp as expires_at,
            status
        FROM data_lifecycle_tasks
        WHERE profile_id = $1 
        AND task_type = $2
        FOR UPDATE
        `,
      [profileId, LifecycleTaskTypes.ExportUserData],
    );

    const { expires_at, status } = expireQueryResult.rows.at(0) || {};
    const isStillValid = expires_at && dayjs(expires_at).isAfter(dayjs());
    const isFailed = status === LifecycleTaskStatuses.Failed;
    const isProcessing = status === LifecycleTaskStatuses.Processing;

    // allowOverride only overrides the 30-day cooldown, never a run that is
    // actually in flight. Without this, a reset landing while the worker is
    // mid-export would be clobbered by markAsCompleted (no status
    // precondition there) once the worker finishes, silently dropping the
    // override request while notifying on the stale (pre-reset) requester.
    if (isProcessing) {
      throw new Error("task is already in progress");
    }

    if (isStillValid && !isFailed && !allowOverride) {
      throw new Error("task can not be reset before expiry");
    }

    let id: string | undefined;
    const updateResult = await client.query<{ id: string }>(
      `
        UPDATE data_lifecycle_tasks
        SET status = $1,
            scheduled_at = $2,
            retry_count = 0,
            error = null,
            metadata = $3::jsonb,
            -- Replace, not merge: intentionally clears a stale uploadId from
            -- the previous export. This also silently drops any metadata key
            -- not present in the literal built above, so adding a new
            -- ExportMetadataSchema key means revisiting this statement.
            requester_user_id = $4,
            requester_application_id = $5,
            updated_at = now()
        WHERE profile_id = $6
            AND task_type = $7
        RETURNING id
        `,
      [
        Pending,
        scheduledAt,
        metadata,
        requesterUserId,
        requesterApplicationId,
        profileId,
        LifecycleTaskTypes.ExportUserData,
      ],
    );
    id = updateResult.rows.at(0)?.id;

    if (!id) {
      id = (
        await createLifecycleTask({
          client,
          lifecycleTaskInput: {
            profile_id: profileId,
            task_type: LifecycleTaskTypes.ExportUserData,
            scheduled_at: scheduledAt,
            metadata,
            requester_user_id: requesterUserId,
            requester_application_id: requesterApplicationId,
          },
        })
      ).id;
    }

    if (!id) {
      throw new Error("failed to upsert task");
    }

    await client.query("COMMIT");
    return id;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
