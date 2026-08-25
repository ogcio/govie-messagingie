import { Type } from "typebox";
import { getGenericResponseSchema } from "~/types/generic-response.js";
import { HttpError } from "~/types/http-error.js";
import { PROFILES_TAG } from "./constants.js";

export const DeleteProfileSchema = {
  tags: [PROFILES_TAG],
  operationId: "deleteProfile",
  params: Type.Object({
    profileId: Type.String({
      description: "ID of the profile to delete",
    }),
  }),
  response: {
    200: getGenericResponseSchema(
      Type.Object({
        taskId: Type.String({ description: "ID of the created task" }),
      }),
    ),
    "4xx": HttpError,
    "5xx": HttpError,
  },
};
