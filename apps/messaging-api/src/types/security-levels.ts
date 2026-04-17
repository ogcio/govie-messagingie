import type { Static } from "typebox";
import { TypeboxStringEnum } from "./schemaDefinitions.js";

export const ConfidentialSecurity = "confidential";
export const PublicSecurity = "public";
export const SecurityLevelsSchema = TypeboxStringEnum(
  [ConfidentialSecurity, PublicSecurity],
  undefined,
  "Confidentiality level of the message",
);
export type SecurityLevels = Static<typeof SecurityLevelsSchema>;
