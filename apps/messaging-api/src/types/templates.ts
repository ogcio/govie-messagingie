import { type Static, Type } from "typebox";
import { HttpError } from "./httpErrors.js";
import {
  AVAILABLE_LANGUAGES,
  getGenericResponseSchema,
  PaginationParamsSchema,
  TypeboxStringEnum,
} from "./schemaDefinitions.js";

const tags = ["Templates"];

/** Common */

export const TemplateIdSchema = Type.Object({
  templateId: Type.String({ format: "uuid" }),
});

export type TemplateId = Static<typeof TemplateIdSchema>;

const IdSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
});

const GenericIdResponseSchema = getGenericResponseSchema(IdSchema);
export type GenericIdResponse = Static<typeof GenericIdResponseSchema>;

/** Delete template */

export const DeleteTemplateReqSchema = {
  description: "Deletes the requested template",
  tags,
  operationId: "DeleteTemplate",
  params: TemplateIdSchema,
  response: {
    200: GenericIdResponseSchema,
    "4xx": HttpError,
    "5xx": HttpError,
  },
};

/** Create Template */

const TemplateContentSchema = Type.Object({
  templateName: Type.String({
    description: "Template name for the related language",
    minLength: 1,
  }),
  language: TypeboxStringEnum(
    AVAILABLE_LANGUAGES,
    undefined,
    "Template content language",
  ),
  subject: Type.String({
    description: "Subject of the template",
    minLength: 1,
  }),
  excerpt: Type.Optional(
    Type.String({
      description: "Brief description of the template content",
    }),
  ),
  plainText: Type.String({
    description: "Plain text version of the template",
    minLength: 1,
  }),
  richText: Type.Optional(
    Type.String({
      description: "Rich text version of the template",
    }),
  ),
});

export type TemplateContent = Static<typeof TemplateContentSchema>;

export const CreateTemplateReqSchema = {
  description: "Creates a new template",
  operationId: "CreateTemplate",
  tags,
  body: Type.Object({
    contents: Type.Array(TemplateContentSchema, { minItems: 1 }),
    variables: Type.Optional(
      Type.Array(
        Type.Object({
          name: Type.String({ minLength: 1 }),
        }),
        {
          minItems: 1,
          description:
            "List of the variables that are needed to be filled to create a message using this template",
        },
      ),
    ),
  }),
  response: {
    "5xx": HttpError,
    "4xx": HttpError,
    201: GenericIdResponseSchema,
  },
};

export type CreateTemplateReqBody = Static<typeof CreateTemplateReqSchema.body>;

/** Update template */

export const UpdateTemplateReqSchema = {
  description: "Updates the requested template",
  operationId: "UpdateTemplate",
  tags,
  params: TemplateIdSchema,
  body: Type.Evaluate(
    Type.Intersect([
      Type.Object({
        id: Type.String({ format: "uuid" }),
      }),
      CreateTemplateReqSchema.body,
    ]),
  ),
  response: {
    200: GenericIdResponseSchema,
    "4xx": HttpError,
    "5xx": HttpError,
  },
};

export type UpdateTemplateReqBody = Static<typeof UpdateTemplateReqSchema.body>;

/** Get template */

const GetTemplateResponseItemSchema = Type.Object({
  contents: Type.Array(TemplateContentSchema),
  fields: Type.Array(
    Type.Object(
      {
        fieldName: Type.String(),
      },
      {
        description:
          "List of the variables that are needed to be filled to create a message using this template",
      },
    ),
  ),
});

export type GetTemplateResponseItem = Static<
  typeof GetTemplateResponseItemSchema
>;

const GetTemplateResponseSchema = getGenericResponseSchema(
  GetTemplateResponseItemSchema,
);

export const GetTemplateReqSchema = {
  description: "Returns the requested template",
  tags,
  operationId: "GetTemplate",
  params: TemplateIdSchema,
  response: {
    200: GetTemplateResponseSchema,
    404: HttpError,
    "5xx": HttpError,
  },
};
export type GetTemplateResponse = Static<typeof GetTemplateResponseSchema>;

/** List templates */

const ListTemplatesResponseItemSchema = Type.Object({
  id: Type.String({
    format: "uuid",
    description: "Unique id of the template",
  }),
  contents: Type.Array(
    Type.Object({
      language: TypeboxStringEnum(
        AVAILABLE_LANGUAGES,
        undefined,
        "Template content language",
      ),
      templateName: Type.String({
        description: "Template name for the related language",
      }),
    }),
  ),
});

export type ListTemplatesResponseItem = Static<
  typeof ListTemplatesResponseItemSchema
>;

const ListTemplatesResponseSchema = getGenericResponseSchema(
  Type.Array(ListTemplatesResponseItemSchema),
);

export type ListTemplatesResponse = Static<typeof ListTemplatesResponseSchema>;

export const ListTemplatesReqSchema = {
  description: "Returns the providers matching the requested query",
  operationId: "ListTemplates",
  querystring: Type.Optional(
    Type.Evaluate(
      Type.Intersect([
        PaginationParamsSchema,
        Type.Object({
          search: Type.Optional(
            Type.String({
              description:
                "If set, filters by template name in all available languages",
            }),
          ),
        }),
      ]),
    ),
  ),
  tags,
  response: {
    200: ListTemplatesResponseSchema,
    "4xx": HttpError,
    "5xx": HttpError,
  },
};

export type ListTemplatesReqQuery = Static<
  typeof ListTemplatesReqSchema.querystring
>;
