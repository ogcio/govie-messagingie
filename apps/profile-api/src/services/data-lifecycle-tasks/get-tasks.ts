import dayjs from "dayjs";
import type { Pool } from "pg";
import type { GetLifecycleTask } from "~/schemas/data-lifecycle-tasks/get-many-user-export.js";
import { LifecycleTaskTypes } from "~/schemas/data-lifecycle-tasks/index.js";

type TaskRow = {
  id: string;
  task_type: string;
  metadata: unknown;
  status: string;
};

function isLifecycleTask(t: unknown): t is GetLifecycleTask {
  if (typeof t !== "object" || t === null) {
    return false;
  }

  const task = t as Record<string, unknown>;

  const baseCheck =
    typeof task.id === "string" &&
    typeof task.type === "string" &&
    typeof task.status === "string";

  if (!baseCheck) {
    return false;
  }

  if (task.metadata !== undefined) {
    if (typeof task.metadata !== "object" || task.metadata === null) {
      return false;
    }

    const metadata = task.metadata as Record<string, unknown>;

    if (
      metadata.type === LifecycleTaskTypes.ExportUserData &&
      metadata.expiresAt !== undefined &&
      typeof metadata.expiresAt === "string" &&
      !dayjs(metadata.expiresAt).isValid()
    ) {
      return false;
    }
  }

  return true;
}

export async function getTasks({
  profileId,
  pgpool,
  taskType,
}: {
  profileId: string | null;
  pgpool: Pool;
  taskType: string | null;
}): Promise<GetLifecycleTask[]> {
  const qureyResult = await pgpool.query<TaskRow>(
    `
            SELECT
                id,
                task_type,
                status,
                metadata
            FROM data_lifecycle_tasks
            WHERE ($1::text IS NULL OR profile_id = $1) AND ($2::text IS NULL OR task_type = $2)
            ORDER BY task_type, created_at DESC
              `,
    [profileId, taskType],
  );

  const lifecycleTasks = qureyResult.rows.map((row) => ({
    id: row.id,
    type: row.task_type,
    status: row.status,
    metadata: row.metadata,
  }));

  if (!lifecycleTasks.every((task) => isLifecycleTask(task))) {
    throw new Error("invalid data parsed");
  }

  return lifecycleTasks;
}
