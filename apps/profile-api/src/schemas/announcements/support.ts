import { type Static, Type } from "typebox";
import { PaginationParamsSchema } from "~/schemas/pagination.js";
import { getGenericResponseSchema } from "~/types/generic-response.js";
import { HttpError } from "~/types/http-error.js";
import { TypeboxBooleanEnum, TypeboxComposite } from "~/types/typebox.js";
import {
  AnnouncementApplicationIdSchema,
  AnnouncementSchema,
  AnnouncementTranslationsInputSchema,
  AnnouncementWithTranslationsSchema,
} from "./shared.js";

export const SupportCreateAnnouncementSchema = {
  tags: ["SupportAnnouncements"],
  operationId: "supportCreateAnnouncement",
  description: "Create an announcement for a specific application",
  body: Type.Object(
    {
      applicationId: AnnouncementApplicationIdSchema,
      isEnabled: TypeboxBooleanEnum(),
      publishDate: Type.String({ format: "date-time" }),
      translations: AnnouncementTranslationsInputSchema,
    },
    {
      additionalProperties: false,
    },
  ),
  response: {
    200: getGenericResponseSchema(
      Type.Object({ id: Type.String({ format: "uuid" }) }),
    ),
    "4xx": HttpError,
    "5xx": HttpError,
  },
};

const SupportListAnnouncementsQuerySchema = TypeboxComposite(
  [
    Type.Object({
      applicationId: Type.Optional(AnnouncementApplicationIdSchema),
      isEnabled: Type.Optional(TypeboxBooleanEnum()),
    }),
    PaginationParamsSchema,
  ],
  {
    additionalProperties: false,
  },
);

export const SupportListAnnouncementsSchema = {
  tags: ["SupportAnnouncements"],
  operationId: "supportListAnnouncements",
  description: "List announcements for support users",
  querystring: SupportListAnnouncementsQuerySchema,
  response: {
    200: getGenericResponseSchema(Type.Array(AnnouncementSchema)),
    "4xx": HttpError,
    "5xx": HttpError,
  },
};

export const SupportGetAnnouncementSchema = {
  tags: ["SupportAnnouncements"],
  operationId: "supportGetAnnouncement",
  description: "Get a support announcement by id",
  params: Type.Object({ id: Type.String({ format: "uuid" }) }),
  response: {
    200: getGenericResponseSchema(AnnouncementWithTranslationsSchema),
    "4xx": HttpError,
    "5xx": HttpError,
  },
};

export const SupportSetAnnouncementEnabledSchema = {
  tags: ["SupportAnnouncements"],
  operationId: "supportSetAnnouncementEnabled",
  description: "Toggle announcement enabled state for support users",
  params: Type.Object({ id: Type.String({ format: "uuid" }) }),
  body: Type.Object(
    {
      isEnabled: TypeboxBooleanEnum(),
    },
    {
      additionalProperties: false,
    },
  ),
  response: {
    200: getGenericResponseSchema(AnnouncementWithTranslationsSchema),
    "4xx": HttpError,
    "5xx": HttpError,
  },
};

export type CreateAnnouncement = Static<
  typeof SupportCreateAnnouncementSchema.body
>;
export type SupportListAnnouncementsQuery = Static<
  typeof SupportListAnnouncementsSchema.querystring
>;
export type UpdateAnnouncementEnabled = Static<
  typeof SupportSetAnnouncementEnabledSchema.body
>;
