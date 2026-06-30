import { type Static, Type } from "typebox";
import { HttpError } from "./httpErrors.js";
import { getGenericResponseSchema } from "./schemaDefinitions.js";

const TAGS_TAGS = ["Tags"];

/** Common */

export const TagIdParamsSchema = Type.Object({
  tagId: Type.String({
    format: "uuid",
    description: "Unique Id of the tag",
  }),
});
export type TagIdParams = Static<typeof TagIdParamsSchema>;

export const TagSchema = Type.Object({
  id: Type.String({ format: "uuid", description: "Unique Id of the tag" }),
  userId: Type.String({ description: "Owner user id" }),
  label: Type.String({ description: "Display name of the tag" }),
  parentTagId: Type.Union([
    Type.String({ format: "uuid", description: "Parent tag id" }),
    Type.Null(),
  ]),
  path: Type.String({ description: "Materialized ltree path" }),
  createdAt: Type.String({ description: "Creation date time" }),
  updatedAt: Type.String({ description: "Last update date time" }),
});
export type Tag = Static<typeof TagSchema>;

/** Create tag */

export const CreateTagBodySchema = Type.Object({
  label: Type.String({
    description: "Display name of the tag",
    minLength: 1,
    maxLength: 100,
  }),
  parentTagId: Type.Optional(
    Type.String({
      format: "uuid",
      description: "Parent tag id (omit for root-level tag)",
    }),
  ),
});
export type CreateTagBody = Static<typeof CreateTagBodySchema>;

const CreateTagResponseSchema = getGenericResponseSchema(
  Type.Object({
    id: Type.String({
      format: "uuid",
      description: "Unique Id of the created tag",
    }),
  }),
);
export type CreateTagResponse = Static<typeof CreateTagResponseSchema>;

export const CreateTagReqSchema = {
  description: "Creates a tag for the logged-in user",
  tags: TAGS_TAGS,
  operationId: "CreateTag",
  body: CreateTagBodySchema,
  response: {
    201: CreateTagResponseSchema,
    "4xx": HttpError,
    "5xx": HttpError,
  },
};

/** Update tag */

export const UpdateTagBodySchema = Type.Object({
  label: Type.Optional(
    Type.String({
      description: "New display name",
      minLength: 1,
      maxLength: 100,
    }),
  ),
  parentTagId: Type.Optional(
    Type.Union([
      Type.String({
        format: "uuid",
        description: "New parent tag id",
      }),
      Type.Null({ description: "Set to null to move to root" }),
    ]),
  ),
});
export type UpdateTagBody = Static<typeof UpdateTagBodySchema>;

const UpdateTagResponseSchema = getGenericResponseSchema(
  Type.Object({
    id: Type.String({ format: "uuid" }),
  }),
);
export type UpdateTagResponse = Static<typeof UpdateTagResponseSchema>;

export const UpdateTagReqSchema = {
  description: "Updates a tag (name and/or parent)",
  tags: TAGS_TAGS,
  operationId: "UpdateTag",
  params: TagIdParamsSchema,
  body: UpdateTagBodySchema,
  response: {
    200: UpdateTagResponseSchema,
    "4xx": HttpError,
    "5xx": HttpError,
  },
};

/** List tags (flat) */

const ListTagsResponseSchema = getGenericResponseSchema(Type.Array(TagSchema));
export type ListTagsResponse = Static<typeof ListTagsResponseSchema>;

export const ListTagsReqSchema = {
  description: "Returns all tags for the logged-in user (flat list)",
  tags: TAGS_TAGS,
  operationId: "ListTags",
  response: {
    200: ListTagsResponseSchema,
    "4xx": HttpError,
    "5xx": HttpError,
  },
};

/** Tag tree */

export const TagTreeNodeSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  label: Type.String(),
  unreadMessages: Type.Number({
    description: "Number of unread messages for the tag",
  }),
  // had to use Type.Any() here because fastify-type-provider-typebox
  // chokes on the recursive schema otherwise
  children: Type.Array(Type.Any()),
});

export type TagTreeNode = Static<typeof TagTreeNodeSchema>;

const TagTreeResponseSchema = getGenericResponseSchema(
  Type.Array(TagTreeNodeSchema),
);
export type TagTreeResponse = Static<typeof TagTreeResponseSchema>;

export const GetTagTreeReqSchema = {
  description:
    "Returns the tag tree for the logged-in user, sorted alphabetically",
  tags: TAGS_TAGS,
  operationId: "GetTagTree",
  response: {
    200: TagTreeResponseSchema,
    "4xx": HttpError,
    "5xx": HttpError,
  },
};

/** Delete tag */

const DeleteTagResponseSchema = getGenericResponseSchema(
  Type.Object({
    id: Type.String({ format: "uuid" }),
  }),
);
export type DeleteTagResponse = Static<typeof DeleteTagResponseSchema>;

export const DeleteTagReqSchema = {
  description:
    "Deletes a tag and its descendants. Any attached messages are returned to the inbox (untagged).",
  tags: TAGS_TAGS,
  operationId: "DeleteTag",
  params: TagIdParamsSchema,
  response: {
    200: DeleteTagResponseSchema,
    "4xx": HttpError,
    "5xx": HttpError,
  },
};

/** Assign tag to message */

export const AssignTagBodySchema = Type.Object({
  tagId: Type.Union([
    Type.String({
      format: "uuid",
      description: "Tag id to assign",
    }),
    Type.Null({ description: "Set to null to remove the tag" }),
  ]),
  messageIds: Type.Array(
    Type.String({
      format: "uuid",
      description: "Message ids to assign/remove the tag on",
    }),
    { minItems: 1 },
  ),
});
export type AssignTagBody = Static<typeof AssignTagBodySchema>;

const AssignTagResponseSchema = getGenericResponseSchema(
  Type.Object({
    tagId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
    messageIds: Type.Array(Type.String({ format: "uuid" })),
  }),
);
export type AssignTagResponse = Static<typeof AssignTagResponseSchema>;

export const AssignTagReqSchema = {
  description: "Assigns or removes a tag on multiple messages",
  tags: TAGS_TAGS,
  operationId: "AssignTagToMessages",
  body: AssignTagBodySchema,
  response: {
    200: AssignTagResponseSchema,
    "4xx": HttpError,
    "5xx": HttpError,
  },
};
