import { Type } from "typebox";
import { HttpError } from "~/types/http-error.js";
import { TypeboxBooleanEnum } from "~/types/typebox.js";
import { ImportProfilesResponseSchema } from "./profiles/import-profiles.js";

const ExecuteJobResponseSchema = ImportProfilesResponseSchema;

export const ExecuteJobReqSchema = {
  description: "Executes the requested job",
  tags: ["Jobs"],
  body: Type.Object({
    token: Type.String({
      description:
        "The security token used to ensure you are allowed to execute this job",
    }),
  }),
  response: {
    202: ExecuteJobResponseSchema,
    "5xx": HttpError,
    "4xx": HttpError,
  },
  params: Type.Object({ profileImportId: Type.String({ format: "uuid" }) }),
  querystring: Type.Object({
    insertPrivateDetails: Type.Optional(TypeboxBooleanEnum("false")),
    onlyPrivateDetails: Type.Optional(TypeboxBooleanEnum("false")),
    batchIndex: Type.Optional(Type.String()),
    totalBatches: Type.Optional(Type.String()),
  }),
};
