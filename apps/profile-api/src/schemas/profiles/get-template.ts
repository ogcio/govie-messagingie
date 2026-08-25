import { Type } from "typebox";
import { PROFILES_TAG } from "./constants.js";

export const GetProfileTemplateSchema = {
  tags: [PROFILES_TAG],
  operationId: "getProfileTemplate",
  response: {
    200: Type.Object({
      type: Type.Literal("Buffer"),
      data: Type.Array(Type.Number()),
    }),
  },
  produces: ["text/csv"],
};
