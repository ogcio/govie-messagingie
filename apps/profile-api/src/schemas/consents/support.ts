import { type Static, Type } from "typebox";
import {
  ConsentSchema,
  ConsentStatusSchema,
  ConsentSubjectSchema,
} from "~/schemas/consents/shared.js";
import { getGenericResponseSchema } from "~/types/generic-response.js";
import { HttpError } from "~/types/http-error.js";
import { TypeboxComposite } from "~/types/typebox.js";

// Single consent submission body schema
export const SupportSubmitConsentBodySchema = Type.Object({
  subject: ConsentSubjectSchema,
  status: ConsentStatusSchema,
});

export type SupportSubmitConsentBody = Static<
  typeof SupportSubmitConsentBodySchema
>;

//  consent submission body schema
export const SupportSubmitConsentsBodySchema = Type.Object({
  profileId: Type.String({ minLength: 1, maxLength: 18 }),
  consents: Type.Array(SupportSubmitConsentBodySchema, {
    minItems: 1,
    maxItems: 10,
  }),
});

export type SupportSubmitConsentsBody = Static<
  typeof SupportSubmitConsentsBodySchema
>;

export const SupportSubmitConsentsResponseSchema = Type.Object({
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
});

export type SupportSubmitConsentsResponse = Static<
  typeof SupportSubmitConsentsResponseSchema
>;

export const SupportSubmitConsentsSchema = {
  tags: ["SupportConsents"],
  operationId: "supportSubmitConsents",
  description: "Submit consents for the logged in user",
  body: SupportSubmitConsentsBodySchema,
  response: {
    201: SupportSubmitConsentsResponseSchema,
    "4xx": HttpError,
    "5xx": HttpError,
  },
};

export const SupportLatestConsentSchema = {
  tags: ["SupportConsents"],
  operationId: "supportLatestConsent",
  description: "Get the latest consent for all available subjects for a user",
  querystring: TypeboxComposite(
    [
      Type.Object({
        profileId: Type.String({ minLength: 1, maxLength: 18 }),
      }),
    ],
    {
      additionalProperties: false,
    },
  ),
  response: {
    200: getGenericResponseSchema(
      Type.Object({
        availableSubjects: Type.Array(ConsentSubjectSchema),
        consents: Type.Array(ConsentSchema),
      }),
    ),
    "4xx": HttpError,
    "5xx": HttpError,
  },
};
