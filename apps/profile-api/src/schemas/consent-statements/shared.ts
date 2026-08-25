import { type Static, Type } from "typebox";

export const ConsentStatementLanguageSchema = Type.Union([
  Type.Literal("en"),
  Type.Literal("ga"),
]);

export const ConsentStatementSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  subject: Type.String({ maxLength: 50 }),
  version: Type.Integer(),
  createdAt: Type.String({ format: "date-time" }),
  publishDate: Type.String({ format: "date-time" }),
  isEnabled: Type.Boolean(),
  createdBy: Type.String(),
});

export const ConsentStatementTranslationSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  consentStatementId: Type.String({ format: "uuid" }),
  description: Type.Union([Type.String(), Type.Null()]),
  disclaimer: Type.Union([Type.String(), Type.Null()]),
  title: Type.String(),
  language: ConsentStatementLanguageSchema,
  createdAt: Type.String({ format: "date-time" }),
});

export const ConsentStatementWithTranslationsSchema = Type.Intersect([
  ConsentStatementSchema,
  Type.Object({
    translations: Type.Record(
      ConsentStatementLanguageSchema,
      ConsentStatementTranslationSchema,
    ),
  }),
]);

export type ConsentStatement = Static<typeof ConsentStatementSchema>;
export type ConsentStatementTranslation = Static<
  typeof ConsentStatementTranslationSchema
>;
export type ConsentStatementWithTranslations = Static<
  typeof ConsentStatementWithTranslationsSchema
>;
export type ConsentStatementLanguage = Static<
  typeof ConsentStatementLanguageSchema
>;
