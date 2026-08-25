import { Type } from "typebox";
import { getGenericResponseSchema } from "~/types/generic-response.js";
import { HttpError } from "~/types/http-error.js";
import { TypeboxBooleanEnum } from "~/types/typebox.js";

export const GetOrganisationSchema = {
  tags: ["Organisations"],
  operationId: "getOrganisation",
  params: Type.Object({
    organisationId: Type.String({
      description: "The organisation ID to get the translation for",
    }),
  }),
  querystring: Type.Object({
    includeCustomData: Type.Optional(
      TypeboxBooleanEnum(
        "false",
        "If true, includes organization customData from Logto in the response.",
      ),
    ),
  }),
  response: {
    200: getGenericResponseSchema(
      Type.Object({
        id: Type.String(),
        translations: Type.Object({
          en: Type.Object({
            name: Type.String(),
            shortName: Type.String(),
          }),
          ga: Type.Object({
            name: Type.String(),
            shortName: Type.String(),
          }),
        }),
        customData: Type.Optional(
          Type.Object({
            allowMyGovId: Type.Optional(Type.Boolean()),
          }),
        ),
      }),
    ),
    "4xx": HttpError,
    "5xx": HttpError,
  },
};
