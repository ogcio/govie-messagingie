import { Type } from "typebox";
import { ConsentWithStatementSchema } from "~/schemas/consents/shared.js";
import { PaginationParamsSchema } from "~/schemas/pagination.js";
import { getGenericResponseSchema } from "~/types/generic-response.js";
import { HttpError } from "~/types/http-error.js";
import { TypeboxComposite } from "~/types/typebox.js";

export const OrganisationListConsentsSchema = {
  tags: ["OrganisationConsents"],
  operationId: "organisationListConsents",
  description: "List the submission for the selected user",
  querystring: TypeboxComposite(
    [
      Type.Object({
        subject: Type.String({
          description: "Service for which list consents",
        }),
        profileId: Type.String({
          description: "User for whom list the consents",
        }),
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

export const OrganisationListLatestConsentsSchema = {
  tags: ["OrganisationConsents"],
  operationId: "organisationListLatestConsents",
  description:
    "List the latest submission for the selected subject. Will return the ones for the specific profile, if set",
  querystring: TypeboxComposite(
    [
      Type.Object({
        subject: Type.String({
          description: "Service for which list consents",
        }),

        profileId: Type.Optional(
          Type.String({
            description: "User for whom list the consents",
          }),
        ),
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
