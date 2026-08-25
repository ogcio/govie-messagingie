import { Type } from "typebox";
import { PaginationParamsSchema } from "~/schemas/pagination.js";
import { getGenericResponseSchema } from "~/types/generic-response.js";
import { HttpError } from "~/types/http-error.js";
import { TypeboxBooleanEnum, TypeboxComposite } from "~/types/typebox.js";
import {
  AnnouncementApplicationIdSchema,
  AnnouncementWithTranslationsSchema,
} from "./shared.js";

export const CitizenListAnnouncementsSchema = {
  tags: ["CitizenAnnouncements"],
  operationId: "citizenListAnnouncements",
  description: "List published announcements for the current citizen profile",
  querystring: TypeboxComposite(
    [
      Type.Object({
        applicationId: AnnouncementApplicationIdSchema,
        newOnly: Type.Optional(TypeboxBooleanEnum()),
      }),
      PaginationParamsSchema,
    ],
    {
      additionalProperties: false,
    },
  ),
  response: {
    200: getGenericResponseSchema(
      Type.Array(AnnouncementWithTranslationsSchema),
    ),
    "4xx": HttpError,
    "5xx": HttpError,
  },
};

export const CitizenAcknowledgeAnnouncementsSchema = {
  tags: ["CitizenAnnouncements"],
  operationId: "citizenAcknowledgeAnnouncements",
  description:
    "Acknowledge the current set of announcements for the current citizen profile",
  body: Type.Object(
    {
      applicationId: AnnouncementApplicationIdSchema,
      announcementIds: Type.Array(Type.String({ format: "uuid" }), {
        minItems: 1,
        uniqueItems: true,
      }),
    },
    {
      additionalProperties: false,
    },
  ),
  response: {
    201: getGenericResponseSchema(
      Type.Object({
        acknowledgedIds: Type.Array(Type.String({ format: "uuid" })),
      }),
    ),
    "4xx": HttpError,
    "5xx": HttpError,
  },
};
