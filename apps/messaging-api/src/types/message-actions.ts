import { type Static, Type } from "typebox";
import { HttpError } from "./httpErrors.js";

const PutMessageActionBodySchema = Type.Object({
  messageId: Type.String({ format: "uuid" }),
  isSeen: Type.Boolean(),
});

export type PutMessageActionBody = Static<typeof PutMessageActionBodySchema>;

const PutMessageActionResponseSchema = Type.Null();
export type PutMessageActionResponse = Static<
  typeof PutMessageActionResponseSchema
>;

export const PutMessageActionReqSchema = {
  tags: ["Message actions"],
  body: PutMessageActionBodySchema,
  response: {
    200: PutMessageActionResponseSchema,
    "4xx": HttpError,
    "5xx": HttpError,
  },
  params: Type.Object({ messageId: Type.String({ format: "uuid" }) }),
};

export type PutMessageActionParams = Static<
  typeof PutMessageActionReqSchema.params
>;
