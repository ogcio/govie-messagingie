import { Type } from "typebox";
import { getGenericResponseSchema } from "~/types/generic-response.js";
import { HttpError } from "~/types/http-error.js";
import { TypeboxBooleanEnum } from "~/types/typebox.js";
import { PROFILES_TAG } from "./constants.js";
import { ProfileWithLinkedProfilesSchema } from "./model.js";

export const GetProfileSchema = {
  tags: [PROFILES_TAG],
  operationId: "getProfile",
  params: Type.Object({
    profileId: Type.String({
      description: "ID of the profile to retrieve",
    }),
  }),
  querystring: Type.Object({
    privateDetails: Type.Optional(TypeboxBooleanEnum("false")),
    organizationId: Type.Optional(Type.String()),
    consentSubjects: Type.Optional(
      Type.String({
        description:
          "Comma-separated list of consent categories to retrieve status for.",
      }),
    ),
  }),
  response: {
    200: getGenericResponseSchema(ProfileWithLinkedProfilesSchema),
    "4xx": HttpError,
    "5xx": HttpError,
  },
};
