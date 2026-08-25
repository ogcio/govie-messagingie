import { type Static, Type } from "typebox";
import { PaginationParamsSchema } from "~/schemas/pagination.js";
import { getGenericResponseSchema } from "~/types/generic-response.js";
import { HttpError } from "~/types/http-error.js";
import { TypeboxBooleanEnum, TypeboxComposite } from "~/types/typebox.js";
import {
  ConsentStatementLanguageSchema,
  ConsentStatementSchema,
  ConsentStatementTranslationSchema,
  ConsentStatementWithTranslationsSchema,
} from "./shared.js";

export const CreateConsentStatementTranslationSchema = Type.Omit(
  ConsentStatementTranslationSchema,
  ["id", "consentStatementId", "language", "createdAt"],
);

export const CreateStatementTranslationsMapSchema = Type.Record(
  ConsentStatementLanguageSchema,
  CreateConsentStatementTranslationSchema,
);

export const CreateConsentStatementSchema = TypeboxComposite([
  Type.Omit(ConsentStatementSchema, [
    "id",
    "createdAt",
    "version",
    "isEnabled",
    "createdBy",
  ]),
  Type.Object({
    isEnabled: TypeboxBooleanEnum(),
    translations: Type.Record(
      ConsentStatementLanguageSchema,
      CreateConsentStatementTranslationSchema,
    ),
  }),
]);

export const UpdateConsentStatementSchema = CreateConsentStatementSchema;

export const OrganisationCurrentConsentStatementSchema = {
  tags: ["OrganisationConsentPolicies"],
  operationId: "organizationCurrentStatement",
  description: "Get the current Statement for a subject",
  querystring: TypeboxComposite(
    [
      Type.Object({
        subject: Type.String(),
      }),
    ],
    {
      additionalProperties: false,
    },
  ),
  response: {
    200: getGenericResponseSchema(
      Type.Array(ConsentStatementWithTranslationsSchema),
    ),
    "4xx": HttpError,
    "5xx": HttpError,
  },
};

export const OrganisationCreateConsentStatementSchema = {
  tags: ["OrganisationConsentPolicies"],
  operationId: "organizationCreateStatement",
  description: "Create Statement for a subject",
  body: CreateConsentStatementSchema,
  response: {
    200: getGenericResponseSchema(
      Type.Object({ id: Type.String({ format: "uuid" }) }),
    ),
    "4xx": HttpError,
    "5xx": HttpError,
  },
};

const OrganizationListStatementsQuerySchema = TypeboxComposite(
  [
    Type.Object({
      subject: Type.Optional(Type.String({ maxLength: 50 })),
      isEnabled: Type.Optional(TypeboxBooleanEnum()),
    }),
    PaginationParamsSchema,
  ],
  {
    additionalProperties: false,
  },
);

export type OrganizationListStatementsQuery = Static<
  typeof OrganizationListStatementsQuerySchema
>;

export const OrganisationListConsentStatementsSchema = {
  tags: ["OrganisationConsentPolicies"],
  operationId: "organizationListStatements",
  description: "List all statements for a subject",
  querystring: OrganizationListStatementsQuerySchema,
  response: {
    200: getGenericResponseSchema(Type.Array(ConsentStatementSchema)),
    "4xx": HttpError,
    "5xx": HttpError,
  },
};

export const OrganisationUpdateConsentStatementSchema = {
  tags: ["OrganisationConsentPolicies"],
  operationId: "organizationUpdateStatement",
  description: "Update statement",
  params: Type.Object({ id: Type.String({ format: "uuid" }) }),
  body: UpdateConsentStatementSchema,
  response: {
    200: getGenericResponseSchema(
      Type.Object({ id: Type.String({ format: "uuid" }) }),
    ),
    "4xx": HttpError,
    "5xx": HttpError,
  },
};

export const OrganisationGetConsentStatementSchema = {
  tags: ["OrganisationConsentPolicies"],
  operationId: "organizationGetStatement",
  description: "Get get a statement by id",
  params: Type.Object({ id: Type.String({ format: "uuid" }) }),
  response: {
    200: getGenericResponseSchema(ConsentStatementWithTranslationsSchema),
    "4xx": HttpError,
    "5xx": HttpError,
  },
};

export const OrganisationDisableConsentStatementSchema = {
  tags: ["OrganisationConsentPolicies"],
  operationId: "organizationDisableStatement",
  description: "Disable a consent statement (User Admin only)",
  params: Type.Object({ id: Type.String({ format: "uuid" }) }),
  response: {
    200: getGenericResponseSchema(ConsentStatementWithTranslationsSchema),
    403: HttpError,
    404: HttpError,
    "5xx": HttpError,
  },
};

export type UpdateConsentStatement = Static<
  typeof UpdateConsentStatementSchema
>;
export type CreateStatementTranslationsMap = Static<
  typeof CreateStatementTranslationsMapSchema
>;
export type CreateConsentStatement = Static<
  typeof CreateConsentStatementSchema
>;
export type CreateConsentStatementTranslation = Static<
  typeof CreateConsentStatementTranslationSchema
>;
