import { type Static, Type } from "typebox";

export const SeederConsentStatementTranslationSchema = Type.Object({
  title: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  disclaimer: Type.Union([Type.String(), Type.Null()]),
});

export const SeederConsentStatementsSchema = Type.Object({
  name: Type.String(),
  publish_date: Type.String({ format: "date-time" }),
  translations: Type.Object({
    en: SeederConsentStatementTranslationSchema,
    ga: SeederConsentStatementTranslationSchema,
  }),
});

export type SeederConsentStatements = Static<
  typeof SeederConsentStatementsSchema
>;
export type SeederConsentStatementTranslation = Static<
  typeof SeederConsentStatementTranslationSchema
>;
