import { Type } from "typebox";
import { getGenericResponseSchema } from "~/types/generic-response.js";
import { HttpError } from "~/types/http-error.js";
import { PROFILES_TAG } from "./constants.js";
import { ProfileWithDetailsListSchema } from "./model.js";

export const SelectProfilesSchema = {
  tags: [PROFILES_TAG],
  operationId: "selectProfiles",
  querystring: Type.Object({
    ids: Type.String({
      description: "Comma-separated list of profile IDs",
      pattern: "^[a-zA-Z0-9-]+(,[a-zA-Z0-9-]+)*$",
    }),
    consentSubjects: Type.Optional(
      Type.String({
        description:
          "Write subjects split by comma, if set will return consent statuses for those subjects, otherwise consent statuses will be null",
      }),
    ),
  }),
  response: {
    200: getGenericResponseSchema(ProfileWithDetailsListSchema),
    "4xx": HttpError,
    "5xx": HttpError,
  },
};
