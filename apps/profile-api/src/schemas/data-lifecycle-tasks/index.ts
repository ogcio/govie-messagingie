import { type Static, Type } from "typebox";
import type { ValueOf } from "~/types/generic.js";
import { TypeboxComposite } from "~/types/typebox.js";

export const tags = ["Lifecycle Tasks"];

export const LifecycleTaskActionQueries = {
  Download: "download",
  ApproveDelete: "approve_delete",
} as const;

export const LifecycleTaskStatuses = {
  Pending: "pending",
  Processing: "processing",
  Completed: "completed",
  Failed: "failed",
} as const;

export type LifecycleTaskStatus = ValueOf<typeof LifecycleTaskStatuses>;

export const LifecycleTaskStatusSchema = Type.Union([
  Type.Literal(LifecycleTaskStatuses.Pending),
  Type.Literal(LifecycleTaskStatuses.Processing),
  Type.Literal(LifecycleTaskStatuses.Completed),
  Type.Literal(LifecycleTaskStatuses.Failed),
]);

export const LifecycleTaskTypes = {
  DeleteProfile: "delete_profile",
  ExportUserData: "export_user_data",
} as const;

export const LifecycleTaskTypeSchema = Type.Union([
  Type.Literal(LifecycleTaskTypes.DeleteProfile),
  Type.Literal(LifecycleTaskTypes.ExportUserData),
]);

export type LifecycleTaskType = ValueOf<typeof LifecycleTaskTypes>;

export const LifecycleTaskActorTypes = {
  M2M: "m2m",
  Citizen: "citizen",
} as const;

export type LifecycleTaskActorType = ValueOf<typeof LifecycleTaskActorTypes>;

// Array of valid lifecycle task types for each actor type, used for validation when creating tasks
export const TaskTypesPerActor: Record<
  LifecycleTaskActorType,
  readonly LifecycleTaskType[]
> = {
  m2m: [LifecycleTaskTypes.DeleteProfile, LifecycleTaskTypes.ExportUserData],
  citizen: [LifecycleTaskTypes.ExportUserData],
} as const;

const MinimumTaskData = Type.Object({
  profile_id: Type.String({ minLength: 1, maxLength: 12 }),
  scheduled_at: Type.String({ format: "date-time" }),
  requester_user_id: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  requester_application_id: Type.Union([
    Type.String({ minLength: 1 }),
    Type.Null(),
  ]),
});

const DeleteProfileTaskData = TypeboxComposite([
  MinimumTaskData,
  Type.Object({
    task_type: Type.Literal(LifecycleTaskTypes.DeleteProfile),
    metadata: Type.Object({}, { additionalProperties: true }),
  }),
]);

const ExportUserDataTaskData = TypeboxComposite([
  MinimumTaskData,
  Type.Object({
    task_type: Type.Literal(LifecycleTaskTypes.ExportUserData),
    metadata: Type.Object({}, { additionalProperties: true }),
  }),
]);

const LifecycleTaskInputSchema = Type.Union([
  DeleteProfileTaskData,
  ExportUserDataTaskData,
]);

export type LifecycleTaskInput = Static<typeof LifecycleTaskInputSchema>;

const LifecycleTaskSchema = TypeboxComposite([
  LifecycleTaskInputSchema,
  Type.Object({
    id: Type.String({ format: "uuid" }),
    retry_count: Type.Number({ minimum: 0, maximum: 32767 }),
    error: Type.Optional(Type.String()),
    status: LifecycleTaskStatusSchema,
    created_at: Type.String({ format: "date-time" }),
    updated_at: Type.String({ format: "date-time" }),
  }),
]);

export type LifecycleTask = Static<typeof LifecycleTaskSchema>;
