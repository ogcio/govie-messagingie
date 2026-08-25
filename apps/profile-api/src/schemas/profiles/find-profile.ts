import { Type } from "typebox";
import { PROFILES_TAG } from "~/schemas/profiles/constants.js";
import { ProfileWithDetailsSchema } from "~/schemas/profiles/model.js";
import { getGenericResponseSchema } from "~/types/generic-response.js";
import { HttpError } from "~/types/http-error.js";

export const FindProfileSchema = {
  tags: [PROFILES_TAG],
  operationId: "findProfile",
  querystring: Type.Object(
    {
      email: Type.Optional(
        Type.String({
          format: "email",
          description: "Email address to search for",
        }),
      ),
      firstName: Type.Optional(
        Type.String({
          description: "First name to search for",
        }),
      ),
      lastName: Type.Optional(
        Type.String({
          description: "Last name to search for",
        }),
      ),
      phone: Type.Optional(
        Type.String({
          description: "Phone number to search for",
        }),
      ),
      consentSubjects: Type.Optional(
        Type.String({
          description:
            "Write subjects split by comma, if set will return consent statuses for those subjects, otherwise consent statuses will be null",
        }),
      ),
    },
    {
      // Require at least one search parameter
      additionalProperties: false,
      minProperties: 1, // at least one search field
    },
  ),
  response: {
    200: getGenericResponseSchema(ProfileWithDetailsSchema),
    "4xx": HttpError,
    "5xx": HttpError,
  },
};
