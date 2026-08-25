import { Type } from "typebox";
import { PaginationParamsSchema } from "~/schemas/pagination.js";
import { getGenericResponseSchema } from "~/types/generic-response.js";
import { HttpError } from "~/types/http-error.js";
import { PROFILES_TAG } from "./constants.js";
import { ProfileWithDetailsListSchema } from "./model.js";

const ProfilesPostIndexBodySchema = Type.Object({
  ppsns: Type.Array(Type.String()),
  organizationId: Type.Optional(Type.String()),
  consentSubjects: Type.Optional(
    Type.String({
      description:
        "Write subjects split by comma, if set will return consent statuses for those subjects, otherwise consent statuses will be null",
    }),
  ),
});

export const ProfilesPostIndexSchema = {
  tags: [PROFILES_TAG],
  operationId: "searchPostProfiles",
  querystring: PaginationParamsSchema,
  body: ProfilesPostIndexBodySchema,
  response: {
    200: getGenericResponseSchema(ProfileWithDetailsListSchema),
    "4xx": HttpError,
    "5xx": HttpError,
  },
};
