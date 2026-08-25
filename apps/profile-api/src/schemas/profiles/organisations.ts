import { type Static, Type } from "typebox";
import { getGenericResponseSchema } from "~/types/generic-response.js";
import { HttpError } from "~/types/http-error.js";

const PatchOrgProfileBodySchema = Type.Object(
  {
    primaryUserId: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false },
);
export type PatchOrgProfileBody = Static<typeof PatchOrgProfileBodySchema>;

const PatchOrgProfileResponseSchema = Type.Object({
  primaryUserId: Type.String(),
});
export type PatchOrgProfileResponse = Static<
  typeof PatchOrgProfileResponseSchema
>;

export const PatchOrgProfileSchema = {
  tags: ["AdminProfiles"],
  operationId: "adminProfilesPatch",
  params: Type.Object({
    profileId: Type.String({
      description: "ID of the profile to update",
    }),
  }),
  body: PatchOrgProfileBodySchema,
  response: {
    200: getGenericResponseSchema(PatchOrgProfileResponseSchema),
    "4xx": HttpError,
    "5xx": HttpError,
  },
};
