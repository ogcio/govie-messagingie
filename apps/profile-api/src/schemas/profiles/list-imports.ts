import { Type } from "typebox";
import { PaginationParamsSchema } from "~/schemas/pagination.js";
import { getGenericResponseSchema } from "~/types/generic-response.js";
import { HttpError } from "~/types/http-error.js";
import { TypeboxComposite } from "~/types/typebox.js";
import { PROFILES_TAG } from "./constants.js";

const ProfileImportListSchema = Type.Array(
  Type.Object({
    id: Type.String({ format: "uuid" }),
    organisationId: Type.Optional(Type.String()),
    status: Type.String(),
    source: Type.Union([Type.Literal("csv"), Type.Literal("json")]),
    metadata: Type.Optional(
      Type.Object({
        filename: Type.String(),
        mimetype: Type.String(),
      }),
    ),
    createdAt: Type.String({ format: "date-time" }),
    updatedAt: Type.String({ format: "date-time" }),
  }),
);

export const ListProfileImportsSchema = {
  description: "List profile imports with pagination",
  tags: [PROFILES_TAG],
  operationId: "listProfileImports",
  querystring: TypeboxComposite([
    Type.Object({
      organizationId: Type.Optional(Type.String()),
      source: Type.Optional(
        Type.Union([Type.Literal("csv"), Type.Literal("json")]),
      ),
      search: Type.Optional(
        Type.String({
          description:
            "If set, the endpoint searches for profile imports with this value in the metadata.filename",
        }),
      ),
    }),
    PaginationParamsSchema,
  ]),
  response: {
    200: getGenericResponseSchema(ProfileImportListSchema),
    "4xx": HttpError,
    "5xx": HttpError,
  },
};
