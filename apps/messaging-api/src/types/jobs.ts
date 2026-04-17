import { type Static, Type } from "typebox";
import { HttpError } from "./httpErrors.js";

export const JobTypes = {
  Message: "message",
};

const ExecuteJobResponseSchema = Type.Null();
export type ExecuteJobResponse = Static<typeof ExecuteJobResponseSchema>;

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
  params: Type.Object({ jobId: Type.String({ format: "uuid" }) }),
};

export type ExecuteJobParams = Static<typeof ExecuteJobReqSchema.params>;
export type ExecuteJobBody = Static<typeof ExecuteJobReqSchema.body>;
