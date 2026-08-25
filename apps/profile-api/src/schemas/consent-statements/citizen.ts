import { Type } from "typebox";
import { getGenericResponseSchema } from "~/types/generic-response.js";
import { HttpError } from "~/types/http-error.js";
import { ConsentStatementWithTranslationsSchema } from "./shared.js";

export const CitizenCurrentConsentStatementSchema = {
  tags: ["CitizenConsentPolicies"],
  operationId: "citizenCurrentStatement",
  description: "Get the current statement for a subject",
  querystring: Type.Object(
    {
      subject: Type.String(),
    },
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

export const CitizenGetConsentStatementSchema = {
  tags: ["CitizenConsentPolicies"],
  operationId: "citizenGetStatement",
  description: "Get a statement by id",
  params: Type.Object({ id: Type.String({ format: "uuid" }) }),
  response: {
    200: getGenericResponseSchema(ConsentStatementWithTranslationsSchema),
    "4xx": HttpError,
    "5xx": HttpError,
  },
};
