import { type Static, Type } from "typebox";
import {
  ConsentStatusSchema,
  ConsentSubjectSchema,
} from "~/schemas/consents/shared.js";
import { TypeboxComposite, TypeboxStringEnum } from "~/types/typebox.js";

export type DetailType = "string" | "number" | "boolean" | "date";

export const DEFAULT_LANGUAGE = "en";

const AvailableLanguagesSchema = TypeboxStringEnum(
  [DEFAULT_LANGUAGE, "ga"],
  DEFAULT_LANGUAGE,
);

export type AvailableLanguages = Static<typeof AvailableLanguagesSchema>;

export const LanguagesWithNoDefault = TypeboxStringEnum([
  DEFAULT_LANGUAGE,
  "ga",
]);

const ProfileDataStringItemSchema = Type.Object({
  value: Type.String(),
  type: Type.Literal("string"),
});

const ProfileDataDateItemSchema = Type.Object({
  value: Type.String(),
  type: Type.Literal("date"),
});

export const MandatoryProfileDataDetailsSchema = Type.Object({
  // not add format email here because this field is used in
  // Value.Parse and it does not supported by it
  email: Type.String({ minLength: 1 }),
  firstName: Type.String({ minLength: 1 }),
  lastName: Type.String({ minLength: 1 }),
});
export type MandatoryProfileDataDetails = Static<
  typeof MandatoryProfileDataDetailsSchema
>;

// Used as output schema to the clients
export const KnownProfileDataDetailsSchema = TypeboxComposite([
  MandatoryProfileDataDetailsSchema,
  Type.Object({
    // The email field should override the
    // one from MandatoryProfileDataDetailsSchema
    // adding the expected format
    email: Type.String({ format: "email" }),
    city: Type.Optional(Type.String()),
    address: Type.Optional(Type.String()),
    phone: Type.Optional(Type.String()),
    dateOfBirth: Type.Optional(Type.String({ format: "date" })),
    ppsn: Type.Optional(Type.String()),
    preferredLanguage: Type.Optional(AvailableLanguagesSchema),
    externalId: Type.Optional(Type.String()),
  }),
]);

export type KnownProfileDataDetails = Static<
  typeof KnownProfileDataDetailsSchema
>;

export type ProfileImportDetail = KnownProfileDataDetails & {
  id: string;
  status: string;
  batch: number;
};

export const PpsnOnlyProfileDataDetailsSchema = Type.Object({
  ppsn: Type.String(),
  externalId: Type.Optional(Type.String()),
  dateOfBirth: Type.Optional(Type.String({ format: "date" })),
});

export type PpsnOnlyProfileDataDetails = Static<
  typeof PpsnOnlyProfileDataDetailsSchema
>;

// Enhanced consent schema for citizen profile responses
const ConsentStatusDetailSchema = Type.Object({
  subject: Type.String(), // The consent subject/category
  status: ConsentStatusSchema,
  submittedAt: Type.Optional(Type.String({ format: "date-time" })), // When the consent was submitted
  statementId: Type.Optional(Type.String({ format: "uuid" })), // UUID of consent statement
  statementVersion: Type.Optional(Type.Number()), // Version number of consent statement
  isLatestStatement: Type.Optional(Type.Boolean()), // Whether this is the latest statement version
});

export type ConsentStatusDetail = Static<typeof ConsentStatusDetailSchema>;

// Legacy schema for backward compatibility
const ConsentListSchema = Type.Record(
  ConsentSubjectSchema,
  Type.Object({
    status: ConsentStatusSchema,
    consent_statement_id: Type.String({ format: "uuid" }),
  }),
);

export type ConsentList = Static<typeof ConsentListSchema>;

// Enhanced consent list schema for citizen profiles - using Type.String for flexible categories
const EnhancedConsentListSchema = Type.Record(
  Type.String(), // Allow any string for category/subject
  ConsentStatusDetailSchema,
);

export type EnhancedConsentList = Static<typeof EnhancedConsentListSchema>;

export const ProfileStatuses = {
  Active: "active",
  Disabled: "disabled",
  Deleted: "deleted",
} as const;

const ProfileStatusSchema = Type.Union(
  [
    Type.Literal(ProfileStatuses.Active),
    Type.Literal(ProfileStatuses.Disabled),
    Type.Literal(ProfileStatuses.Deleted),
  ],
  { default: ProfileStatuses.Active },
);

export type ProfileStatus = Static<typeof ProfileStatusSchema>;

const ProfileSchema = Type.Object({
  id: Type.String(),
  publicName: Type.String(),
  email: Type.String({ format: "email" }),
  primaryUserId: Type.String(),
  safeLevel: Type.Optional(Type.Number()),
  preferredLanguage: Type.Optional(AvailableLanguagesSchema),
  createdAt: Type.Optional(Type.String({ format: "date-time" })),
  updatedAt: Type.Optional(Type.String({ format: "date-time" })),
  consentStatuses: Type.Optional(
    Type.Union([EnhancedConsentListSchema, ConsentListSchema, Type.Null()]),
  ),
  status: ProfileStatusSchema,
});

const LinkedProfileSchema = Type.Pick(ProfileSchema, [
  "id",
  "email",
  "publicName",
]);

export type LinkedProfile = Static<typeof LinkedProfileSchema>;

export const ProfileWithDetailsSchema = TypeboxComposite([
  ProfileSchema,
  Type.Object({
    details: Type.Optional(KnownProfileDataDetailsSchema),
  }),
]);

export const ProfileWithLinkedProfilesSchema = TypeboxComposite([
  ProfileWithDetailsSchema,
  Type.Object({
    linkedProfiles: Type.Optional(
      Type.Array(LinkedProfileSchema, {
        description:
          "Linked profiles that have the current profile as primary profile",
      }),
    ),
  }),
]);

export const ProfileWithDetailsListSchema = Type.Array(
  ProfileWithDetailsSchema,
);
export type Profile = Static<typeof ProfileSchema>;
export type ProfileWithDetails = Static<typeof ProfileWithDetailsSchema>;
export type ProfileWithLinkedProfiles = Static<
  typeof ProfileWithLinkedProfilesSchema
>;
export const ProfileImportSchema = Type.Object({
  organisationId: Type.String(),
  status: Type.String(),
  createdAt: Type.Optional(Type.String({ format: "date-time" })),
  metadata: Type.Object({
    filename: Type.String(),
    mimetype: Type.String(),
  }),
});

// Used to query the db
// build a type with same keys as KnownProfileDataDetails but
// where all the values are of type ProfileDataItemSchema
const KnownProfileDbDataDetailsSchema = Type.Object({
  city: ProfileDataStringItemSchema,
  email: ProfileDataStringItemSchema,
  address: ProfileDataStringItemSchema,
  phone: ProfileDataStringItemSchema,
  firstName: ProfileDataStringItemSchema,
  lastName: ProfileDataStringItemSchema,
  dateOfBirth: ProfileDataDateItemSchema,
  ppsn: ProfileDataStringItemSchema,
});

export type KnownProfileDbDataDetails = Static<
  typeof KnownProfileDbDataDetailsSchema
>;

const ProfileWithDetailsFromDbSchema = TypeboxComposite([
  ProfileSchema,
  Type.Object({ details: Type.Optional(KnownProfileDbDataDetailsSchema) }),
  Type.Object({
    profileDetailsId: Type.String(),
  }),
]);

export type ProfileWithDetailsFromDb = Static<
  typeof ProfileWithDetailsFromDbSchema
>;
