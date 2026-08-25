import { type Static, Type } from "typebox";
import { PaginationParamsSchema } from "~/schemas/pagination.js";
import { getGenericResponseSchema } from "~/types/generic-response.js";
import { HttpError } from "~/types/http-error.js";
import { TypeboxBooleanEnum, TypeboxComposite } from "~/types/typebox.js";
import { PROFILES_TAG } from "./constants.js";
import { ProfileWithDetailsListSchema } from "./model.js";

const ListProfilesSearchParamsSchema = Type.Object({
  search: Type.Optional(
    Type.String({
      description:
        "If set, the endpoint searches for users whom contain this value in either the public name or the email address",
    }),
  ),
  firstName: Type.Optional(
    Type.String({
      description:
        "If set, the endpoint searches for users whom contain this value in either the imported first name",
    }),
  ),
  lastName: Type.Optional(
    Type.String({
      description:
        "If set, the endpoint searches for users whom contain this value in either the imported last name",
    }),
  ),
  email: Type.Optional(
    Type.String({
      description:
        "If set, the endpoint searches for users whom contain this value in either the imported email",
    }),
  ),
  privateDetails: Type.Optional(
    TypeboxBooleanEnum(
      "false",
      "If true and super admin permissions are available, it returns users with private details.",
    ),
  ),
  consentSubjects: Type.Optional(
    Type.String({
      description:
        "Write subjects split by comma, if set will return consent statuses for those subjects, otherwise consent statuses will be null",
    }),
  ),
});

export type ListProfilesSearchParams = Static<
  typeof ListProfilesSearchParamsSchema
>;

export const ProfilesIndexSchema = {
  tags: [PROFILES_TAG],
  operationId: "indexProfiles",
  querystring: TypeboxComposite([
    ListProfilesSearchParamsSchema,
    PaginationParamsSchema,
  ]),
  response: {
    200: getGenericResponseSchema(ProfileWithDetailsListSchema),
    "4xx": HttpError,
    "5xx": HttpError,
  },
};
