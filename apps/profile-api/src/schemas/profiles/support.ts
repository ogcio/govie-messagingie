import { type Static, Type } from "typebox";
import { PaginationParamsSchema } from "~/schemas/pagination.js";
import { getGenericResponseSchema } from "~/types/generic-response.js";
import { HttpError } from "~/types/http-error.js";
import { TypeboxComposite } from "~/types/typebox.js";
import {
  ConsentStatusSchema,
  ConsentSubjectSchema,
} from "../consents/shared.js";
import { SUPPORT_PROFILES_TAG } from "./constants.js";

const SupportSearchBodySchema = Type.Object({
  name: Type.Optional(
    Type.Array(
      Type.String({
        description:
          "If set, the endpoint searches for users whom contain this value in either the public name or the first name/last name",
      }),
      { default: [] },
    ),
  ),
  email: Type.Optional(
    Type.Array(
      Type.String({
        description:
          "If set, the endpoint searches for users whom contain this value in the latest imported email",
      }),
      { default: [] },
    ),
  ),
  ppsn: Type.Optional(
    Type.Array(
      Type.String({
        description:
          "If set, the endpoint searches for users whom contain this value in the latest imported PPSN",
      }),
      { default: [] },
    ),
  ),
  dateOfBirth: Type.Optional(
    Type.Array(
      Type.Object({
        from: Type.Optional(
          Type.String({
            format: "date",
            description:
              "If set, the endpoint searches for users whose date of birth is from this date (inclusive)",
          }),
        ),
        to: Type.Optional(
          Type.String({
            format: "date",
            description:
              "If set, the endpoint searches for users whose date of birth is to this date (inclusive)",
          }),
        ),
      }),
      { default: [] },
    ),
  ),
  id: Type.Optional(
    Type.Array(
      Type.String({
        description:
          "If set, the endpoint searches for users that have this value as id",
      }),
      { default: [] },
    ),
  ),
  logicalOperator: Type.Optional(
    Type.Union(
      [
        Type.Literal("and", {
          description:
            "If set to 'and', the endpoint returns users that match all the provided search criteria. If not set or set to 'or', the endpoint returns users that match at least one of the provided search criteria",
        }),
        Type.Literal("or", {
          description:
            "If set to 'or', the endpoint returns users that match at least one of the provided search criteria",
        }),
      ],
      { default: "and" },
    ),
  ),
});

export type SupportSearchBody = Static<typeof SupportSearchBodySchema>;

const SupportSearchResponseSchema = Type.Array(
  Type.Object({
    id: Type.String(),
    publicName: Type.String(),
    email: Type.String(),
    organisationId: Type.Union([Type.String(), Type.Null()]),
    ppsn: Type.Union([Type.String(), Type.Null()]),
    dateOfBirth: Type.Union([Type.String(), Type.Null()]),
    primaryUserId: Type.String(),
    createdAt: Type.String({ format: "date-time" }),
    updatedAt: Type.String({ format: "date-time" }),
    deletedAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
    preferredLanguage: Type.String({
      description: "The preferred language of the user, in ISO 639-1 format",
    }),
    status: Type.String({
      description:
        "The status of the user, either 'active' or 'disabled' or 'deleted'",
    }),
    safeLevel: Type.Integer({
      description: "The safe level of the user",
    }),
    consentStatuses: Type.Record(
      ConsentSubjectSchema,
      Type.Object({
        status: ConsentStatusSchema,
        consent_statement_id: Type.String({ format: "uuid" }),
      }),
    ),
    firstName: Type.Union([Type.String(), Type.Null()]),
    lastName: Type.Union([Type.String(), Type.Null()]),
  }),
);

export type SupportSearchResponse = Static<typeof SupportSearchResponseSchema>;

export const SupportSearchSchema = {
  tags: [SUPPORT_PROFILES_TAG],
  operationId: "searchSupportProfiles",
  body: TypeboxComposite([SupportSearchBodySchema, PaginationParamsSchema]),
  response: {
    200: getGenericResponseSchema(SupportSearchResponseSchema),
    "4xx": HttpError,
    "5xx": HttpError,
  },
};
