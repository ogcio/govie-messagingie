import { type Static, Type } from "typebox";
import {
  ConsentSchema,
  ConsentStatusSchema,
  ConsentSubjectSchema,
  ConsentWithStatementSchema,
} from "~/schemas/consents/shared.js";
import { PaginationParamsSchema } from "~/schemas/pagination.js";
import { getGenericResponseSchema } from "~/types/generic-response.js";
import { HttpError } from "~/types/http-error.js";
import { TypeboxComposite } from "~/types/typebox.js";

export const CitizenListConsentsSchema = {
  tags: ["CitizenConsents"],
  operationId: "citizenListConsents",
  description:
    "List the consents for a user, sorted by descending submission date",
  querystring: TypeboxComposite(
    [
      Type.Object({
        subject: ConsentSubjectSchema,
      }),
      PaginationParamsSchema,
    ],
    {
      additionalProperties: false,
    },
  ),
  response: {
    200: getGenericResponseSchema(Type.Array(ConsentWithStatementSchema)),
    "4xx": HttpError,
    "5xx": HttpError,
  },
};

// Single consent submission body schema
export const CitizenSubmitConsentBodySchema = Type.Object({
  subject: ConsentSubjectSchema,
  status: ConsentStatusSchema,
  consentStatementId: Type.String({ format: "uuid" }),
});

export type CitizenSubmitConsentBody = Static<
  typeof CitizenSubmitConsentBodySchema
>;

//  consent submission body schema
export const CitizenSubmitConsentsBodySchema = Type.Object({
  consents: Type.Array(CitizenSubmitConsentBodySchema, {
    minItems: 1,
    maxItems: 10,
  }),
});

export type CitizenSubmitConsentsBody = Static<
  typeof CitizenSubmitConsentsBodySchema
>;

// Error response schema for validation errors
export const ConsentValidationErrorSchema = Type.Object({
  subject: Type.String(),
  consentStatementId: Type.String({ format: "uuid" }),
  errors: Type.Array(Type.String()),
});

export const CitizenSubmitConsentsResponseSchema = Type.Object({
  data: Type.Array(
    Type.Object({
      id: Type.String({ format: "uuid" }),
      subject: Type.String(),
      status: ConsentStatusSchema,
      submittedAt: Type.String({ format: "date-time" }),
      consentStatementId: Type.String({ format: "uuid" }),
      statementVersion: Type.Number(),
      isLatestStatement: Type.Boolean(),
    }),
  ),
  errors: Type.Optional(Type.Array(ConsentValidationErrorSchema)),
});

export type CitizenSubmitConsentsResponse = Static<
  typeof CitizenSubmitConsentsResponseSchema
>;

export const CitizenSubmitConsentsSchema = {
  tags: ["CitizenConsents"],
  operationId: "citizenSubmitConsents",
  description: "Submit consents for the logged in user",
  body: CitizenSubmitConsentsBodySchema,
  response: {
    201: CitizenSubmitConsentsResponseSchema,
    400: Type.Object({
      errors: Type.Array(ConsentValidationErrorSchema),
    }),
    "4xx": HttpError,
    "5xx": HttpError,
  },
};

export const CitizenLatestConsentSchema = {
  tags: ["CitizenConsents"],
  operationId: "citizenLatestConsent",
  description: "Get the latest consent for a user",
  querystring: TypeboxComposite(
    [
      Type.Object({
        subject: ConsentSubjectSchema,
      }),
    ],
    {
      additionalProperties: false,
    },
  ),
  response: {
    200: getGenericResponseSchema(ConsentSchema),
    "4xx": HttpError,
    "5xx": HttpError,
  },
};
