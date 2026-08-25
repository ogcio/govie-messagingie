import { Type } from "typebox";
import { getGenericResponseSchema } from "~/types/generic-response.js";
import { HttpError } from "~/types/http-error.js";
import { TypeboxComposite } from "~/types/typebox.js";
import { PROFILES_TAG } from "./constants.js";
import { KnownProfileDataDetailsSchema } from "./model.js";

export const GetProfileImportDetailsSchema = {
  tags: [PROFILES_TAG],
  description: "Get details of profiles in a specific import",
  operationId: "getProfileImportDetails",
  params: Type.Object({
    importId: Type.String(),
  }),
  response: {
    200: getGenericResponseSchema(
      Type.Object({
        metadata: Type.Optional(
          Type.Object({
            filename: Type.Optional(Type.String()),
            mimetype: Type.Optional(Type.String()),
          }),
        ),
        organisationId: Type.String(),
        status: Type.String(),
        createdAt: Type.Optional(Type.String({ format: "date-time" })),
        details: Type.Array(
          TypeboxComposite([
            KnownProfileDataDetailsSchema,
            Type.Object({ status: Type.String() }),
          ]),
        ),
      }),
    ),

    "4xx": HttpError,
    "5xx": HttpError,
  },
} as const;
