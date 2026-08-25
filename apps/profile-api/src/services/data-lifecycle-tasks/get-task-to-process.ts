import type { Pool, PoolClient } from "pg";
import {
  type LifecycleTask,
  LifecycleTaskStatuses,
  type LifecycleTaskType,
} from "~/schemas/data-lifecycle-tasks/index.js";

type QueryEngine = { query: PoolClient["query"] };

interface TaskSelectionParams {
  maxRetryCount: number;
  cooldownPeriodSeconds: number;
  taskTypes: LifecycleTaskType[];
  profileId?: string;
}

// Single source of truth for "which pending task is eligible to run next",
// shared by the read (getPendingTask) and the atomic claim (claimNextTask) so
// the two can never drift apart. Uses positional params $1..$5.
const ELIGIBLE_PENDING_TASK_WHERE = `
    -- get only pending tasks that are scheduled to run now or in the past
    WHERE status = $1 AND scheduled_at <= NOW()
    -- and passed the cooldown period since last attempt or never processed
    AND (updated_at < now() - ($3 * interval '1 second') OR retry_count = 0)
    -- and have not exceeded max retry count
    AND retry_count < $2
    AND ($4::text IS NULL OR task_type = ANY($4::text[]))
    AND ($5::text IS NULL OR profile_id = $5::text)
    ORDER BY created_at LIMIT 1`;

function selectionParams(params: TaskSelectionParams): unknown[] {
  return [
    LifecycleTaskStatuses.Pending,
    params.maxRetryCount,
    params.cooldownPeriodSeconds,
    params.taskTypes,
    params.profileId,
  ];
}

function resolveEngine(
  params: { pool: Pool } | { client: PoolClient },
): QueryEngine {
  return "pool" in params ? params.pool : params.client;
}

/**
 * Read-only lookup of the next eligible pending task. Does NOT change the task
 * state, so two concurrent callers can observe the same row. Use
 * {@link claimNextTask} from the worker loop; keep this for read paths/tests.
 */
export async function getPendingTask(
  params: TaskSelectionParams & ({ pool: Pool } | { client: PoolClient }),
): Promise<LifecycleTask | null> {
  const res = await resolveEngine(params).query<LifecycleTask>(
    `
    SELECT
      ${getLifecycleTaskDbFieldsToSelect()}
    FROM data_lifecycle_tasks
    ${ELIGIBLE_PENDING_TASK_WHERE}
    FOR UPDATE SKIP LOCKED`,
    selectionParams(params),
  );

  return res.rows.length > 0 ? res.rows[0] : null;
}

/**
 * Atomically claims the next eligible pending task and transitions it to
 * `processing` in a SINGLE statement. The row lock taken by the inner
 * `SELECT ... FOR UPDATE SKIP LOCKED` is held for the whole `UPDATE`, so with
 * multiple worker replicas two concurrent claims can never win the same row —
 * the loser's `SKIP LOCKED` simply skips it and picks the next one (or gets
 * nothing). Returns the claimed task (already in `processing`) or null.
 *
 * This replaces the previous non-atomic "SELECT (autocommit) then UPDATE"
 * sequence, where the FOR UPDATE lock was released the instant the SELECT
 * committed, leaving a window in which two replicas could claim the same task.
 */
export async function claimNextTask(
  params: TaskSelectionParams & ({ pool: Pool } | { client: PoolClient }),
): Promise<LifecycleTask | null> {
  const res = await resolveEngine(params).query<LifecycleTask>(
    `
    UPDATE data_lifecycle_tasks
    SET status = $6, updated_at = NOW()
    WHERE id = (
      SELECT id
      FROM data_lifecycle_tasks
      ${ELIGIBLE_PENDING_TASK_WHERE}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING ${getLifecycleTaskDbFieldsToSelect()}`,
    [...selectionParams(params), LifecycleTaskStatuses.Processing],
  );

  return res.rows.length > 0 ? res.rows[0] : null;
}

export function getLifecycleTaskDbFieldsToSelect(): string {
  return `
      id,
      task_type,
      profile_id,
      status,
      scheduled_at ,
      retry_count ,
      error ,
      metadata,
      requester_user_id,
      requester_application_id,
      created_at,
      updated_at`;
}
