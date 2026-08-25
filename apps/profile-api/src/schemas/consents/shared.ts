import { type Static, Type } from "typebox";
import { TypeboxComposite } from "~/types/typebox.js";

export const ConsentStatuses = {
  Pending: "pending",
  Undefined: "undefined",
  PreApproved: "pre-approved",
  OptedOut: "opted-out",
  OptedIn: "opted-in",
} as const;

export const ConsentStatusSchema = Type.Union([
  Type.Literal(ConsentStatuses.Pending),
  Type.Literal(ConsentStatuses.Undefined),
  Type.Literal(ConsentStatuses.PreApproved),
  Type.Literal(ConsentStatuses.OptedOut),
  Type.Literal(ConsentStatuses.OptedIn),
]);

// Status transition validation
export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  [ConsentStatuses.Undefined]: [ConsentStatuses.Pending],
  [ConsentStatuses.PreApproved]: [
    ConsentStatuses.OptedIn,
    ConsentStatuses.OptedOut,
  ],
  [ConsentStatuses.Pending]: [
    ConsentStatuses.OptedIn,
    ConsentStatuses.OptedOut,
  ],
  [ConsentStatuses.OptedIn]: [
    ConsentStatuses.OptedIn,
    ConsentStatuses.OptedOut,
  ],
  [ConsentStatuses.OptedOut]: [
    ConsentStatuses.OptedIn,
    ConsentStatuses.OptedOut,
  ],
};

export function isValidStatusTransition(
  fromStatus: string | null,
  toStatus: string,
): boolean {
  if (!fromStatus) {
    // New consent - can start with any status
    return true;
  }

  const allowedTransitions = VALID_STATUS_TRANSITIONS[fromStatus];
  return allowedTransitions ? allowedTransitions.includes(toStatus) : false;
}

export const ConsentSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  profileId: Type.String(),
  status: ConsentStatusSchema,
  subject: Type.String(),
  createdAt: Type.String(),
  consentStatementId: Type.String({ format: "uuid" }),
});

export const ConsentSubjects = {
  Messaging: "messaging",
} as const;

// Updated to support dynamic categories while maintaining backward compatibility
export const ConsentSubjectSchema = Type.String({
  minLength: 1,
  maxLength: 50,
  pattern: "^[a-zA-Z0-9_-]+$", // Allow letters, numbers, underscores, and hyphens
});

export const ConsentWithStatementSchema = TypeboxComposite([
  ConsentSchema,
  Type.Object({
    consentStatement: Type.Object({ version: Type.Number() }),
    cascadeReason: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    cascadeSourceProfileId: Type.Optional(
      Type.Union([Type.String(), Type.Null()]),
    ),
    sourceProfileEmail: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    targetProfileEmail: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  }),
]);

export type ConsentSubject = Static<typeof ConsentSubjectSchema>;
export type ConsentStatus = Static<typeof ConsentStatusSchema>;
export type Consent = Static<typeof ConsentSchema>;
export type ConsentWithStatement = Static<typeof ConsentWithStatementSchema>;

export const CascadeConsentReasons = {
  AccountLinking: "account_linking",
  ExplicitSubmission: "explicit_consent_submission",
  ManualAdminAction: "manual_admin_action",
  FirstLogin: "first_login",
  FirstImport: "first_import",
} as const;

export type CascadeConsentReason =
  (typeof CascadeConsentReasons)[keyof typeof CascadeConsentReasons];
