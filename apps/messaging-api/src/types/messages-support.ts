import { type Static, Type } from "typebox";
import { HttpError } from "./httpErrors.js";
import {
  getGenericResponseSchema,
  PaginationParamsSchema,
} from "./schemaDefinitions.js";

const MESSAGES_TAGS = ["Messages Support"];
/** List messages */

export const SupportMessageItemSchema = Type.Object({
  id: Type.String({ description: "Unique Id of the message" }),
  organisationId: Type.String({ description: "Organisation sender id" }),
  recipientUserId: Type.String({ description: "Unique id of the recipient" }),
  threadName: Type.Union([
    Type.String({
      description: "Thread Name used to group messages",
    }),
    Type.Null(),
  ]),
  isSeen: Type.Boolean({ description: "Whether the message has been seen" }),
  subject: Type.String({ description: "Subject" }),
  richText: Type.Union([
    Type.String({
      description: "Rich text content of the message",
    }),
    Type.Null(),
  ]),
  plainText: Type.String({ description: "Plain text content of the message" }),
  createdAt: Type.String({ description: "Creation date time" }),
  scheduledAt: Type.String({ description: "Scheduled date time" }),

  attachmentIds: Type.Array(Type.String({ description: "Attachment Ids" })),
});
export type SupportMessageItem = Static<typeof SupportMessageItemSchema>;

export const SupportMessageListSchema = Type.Array(SupportMessageItemSchema);
export type SupportMessageList = Static<typeof SupportMessageListSchema>;

const SupportListMessageResponseSchema = getGenericResponseSchema(
  SupportMessageListSchema,
);
export type SupportListMessageResponse = Static<
  typeof SupportListMessageResponseSchema
>;

const SupportBodyParamsSchema = Type.Object({
  recipientUserIds: Type.Array(
    Type.String({ description: "Unique id of the recipient" }),
    {
      description: "Filter messages by recipient user ids",
      minItems: 1,
      maxItems: 10,
    },
  ),
});

export type SupportBodyParams = Static<typeof SupportBodyParamsSchema>;

const SupportQueryParamsSchema = Type.Evaluate(
  Type.Intersect([
    PaginationParamsSchema,
    Type.Object({
      deletedAfterDateTime: Type.Optional(
        Type.String({
          format: "date-time",
          description: "Filter messages deleted after specified date",
        }),
      ),
    }),
  ]),
);

export type SupportQueryParams = Static<typeof SupportQueryParamsSchema>;

export const SupportListMessagesRequestSchema = {
  description:
    "Returns all the messages for the requested organisation or the requested recipient",
  tags: MESSAGES_TAGS,
  operationId: "SupportListMessagesPost",
  body: SupportBodyParamsSchema,
  querystring: SupportQueryParamsSchema,
  response: {
    200: SupportListMessageResponseSchema,
    "4xx": HttpError,
    "5xx": HttpError,
  },
};
