import { type Static, Type } from "typebox";
import { HttpError } from "~/types/http-error.js";
import { LifecycleTaskTypeSchema, tags } from "./index.js";

const DefaultCreateLifecycleTaskBodySchema = Type.Object({
  type: LifecycleTaskTypeSchema,
  profileId: Type.String(),
  requesterUserId: Type.Optional(Type.String({ minLength: 1 })),
});

export type DefaultCreateLifecycleTaskBody = Static<
  typeof DefaultCreateLifecycleTaskBodySchema
>;

export const CreateLifecycleTaskBodySchema = Type.Union([
  DefaultCreateLifecycleTaskBodySchema,
]);

export type CreateLifecycleTaskBody = Static<
  typeof CreateLifecycleTaskBodySchema
>;

const Response = Type.Object({
  data: Type.Object({
    id: Type.String({ format: "uuid" }),
  }),
});

export const CreateLifecycleTaskSchema = {
  tags,
  operationId: "createLifecycleTask",
  body: CreateLifecycleTaskBodySchema,
  response: {
    202: Response,
    "4xx": HttpError,
    "5xx": HttpError,
  },
};
