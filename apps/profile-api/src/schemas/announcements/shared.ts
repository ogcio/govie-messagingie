import { type Static, Type } from "typebox";
import { TypeboxStringEnum } from "~/types/typebox.js";

const AnnouncementLanguages = ["en", "ga"] as const;

export type AnnouncementLanguage = (typeof AnnouncementLanguages)[number];

export const AnnouncementLanguageSchema = TypeboxStringEnum([
  ...AnnouncementLanguages,
]);

const AnnouncementApplicationIds = [
  "profile",
  "dashboard",
  "messaging",
] as const;

export type AnnouncementApplicationId =
  (typeof AnnouncementApplicationIds)[number];

export const AnnouncementApplicationIdSchema = TypeboxStringEnum([
  ...AnnouncementApplicationIds,
]);

export const AnnouncementTranslationInputSchema = Type.Object(
  {
    title: Type.String({ minLength: 1 }),
    description: Type.String({ minLength: 1 }),
  },
  {
    additionalProperties: false,
  },
);

export const AnnouncementTranslationsInputSchema = Type.Object(
  {
    en: AnnouncementTranslationInputSchema,
    ga: AnnouncementTranslationInputSchema,
  },
  {
    additionalProperties: false,
  },
);

export const AnnouncementSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  applicationId: Type.String({ minLength: 1 }),
  isEnabled: Type.Boolean(),
  publishDate: Type.String({ format: "date-time" }),
  createdAt: Type.String({ format: "date-time" }),
  createdBy: Type.Union([Type.String(), Type.Null()]),
});

export const AnnouncementTranslationSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  announcementId: Type.String({ format: "uuid" }),
  language: AnnouncementLanguageSchema,
  title: Type.String(),
  description: Type.String(),
  createdAt: Type.String({ format: "date-time" }),
});

export const AnnouncementTranslationsSchema = Type.Object(
  {
    en: AnnouncementTranslationSchema,
    ga: AnnouncementTranslationSchema,
  },
  {
    additionalProperties: false,
  },
);

export const AnnouncementWithTranslationsSchema = Type.Intersect([
  AnnouncementSchema,
  Type.Object({
    translations: AnnouncementTranslationsSchema,
  }),
]);

export type Announcement = Static<typeof AnnouncementSchema>;
export type AnnouncementTranslation = Static<
  typeof AnnouncementTranslationSchema
>;
export type AnnouncementTranslationInput = Static<
  typeof AnnouncementTranslationInputSchema
>;
export type AnnouncementTranslationsInput = Static<
  typeof AnnouncementTranslationsInputSchema
>;
export type AnnouncementWithTranslations = Static<
  typeof AnnouncementWithTranslationsSchema
>;
