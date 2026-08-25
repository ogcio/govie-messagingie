import { type Static, Type } from "typebox";
import { HttpError } from "~/types/http-error.js";
import {
  LifecycleTaskStatusSchema,
  LifecycleTaskTypeSchema,
  tags,
} from "./index.js";

const ExportMetadataSchema = Type.Object(
  {
    expiresAt: Type.Optional(Type.String({ format: "date-time" })), // ISO 8601 string
    uploadId: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

const GetLifecycleTaskSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    type: LifecycleTaskTypeSchema,
    status: LifecycleTaskStatusSchema,
    metadata: Type.Union([ExportMetadataSchema, Type.Null()]),
  },
  { additionalProperties: false },
);

export const GetManyLifecycleTaskResponseSchema = Type.Object({
  data: Type.Object({ tasks: Type.Array(GetLifecycleTaskSchema) }),
});
export type GetLifecycleTask = Static<typeof GetLifecycleTaskSchema>;
export type ExportMetadata = Static<typeof ExportMetadataSchema>;
export type GetManyLifecycleTaskResponse = Static<
  typeof GetManyLifecycleTaskResponseSchema
>;

const GetManyLifecycleTaskBodySchema = Type.Object({
  profileId: Type.Optional(Type.String()),
  taskType: Type.Optional(LifecycleTaskTypeSchema),
});

export type GetManyLifecycleTaskBody = Static<
  typeof GetManyLifecycleTaskBodySchema
>;
export const GetManyLifecycleTaskSchema = {
  tags,
  operationId: "getLifecycleTasks",
  body: GetManyLifecycleTaskBodySchema,
  response: {
    200: GetManyLifecycleTaskResponseSchema,
    "4xx": HttpError,
    "5xx": HttpError,
  },
};
