import { ENTRA_ID_IDENTITY, MY_GOV_ID_IDENTITY } from "~/const/logto.js";
import {
  type ConsentStatus,
  ConsentStatuses,
} from "~/schemas/consents/shared.js";
import { getCurrentUTCDate } from "~/utils/dates.js";

export type WebhookUser = {
  id: string;
  details?: {
    firstName: string;
    lastName: string;
    email: string;
    dateOfBirth?: string;
    phone?: string;
    ppsn?: string;
  };
  email: string;
  primaryUserId: string;
  createdAt: string;
  organizationId?: string | null;
  profileImportId?: string | null;
  consentStatusOnDirectSignin: ConsentStatus;
};

type InputIdentity = {
  details: {
    email?: string | null;
    name?: string | null;
    rawData: Record<
      string,
      string | number | boolean | null | (string | number | boolean | null)[]
    >;
  };
};

export const webhookBodyToUser = (
  bodyData: {
    identities: Record<string, InputIdentity> | null;
    id: string;
    customData?: {
      organizationId?: string | null;
      profileImportId?: string | null;
    };
    name?: string | null;
    primaryEmail: string;
    applicationId?: string;
  },
  otpApplicationIds: string[],
): WebhookUser => {
  // From MyGovid
  if (bodyData.identities?.[MY_GOV_ID_IDENTITY]) {
    const identity = bodyData.identities[MY_GOV_ID_IDENTITY];
    return myGovIdBodyToUser(identity, bodyData.id, bodyData.primaryEmail);
  }

  //From Entra
  if (bodyData.identities?.[ENTRA_ID_IDENTITY]) {
    const identity = bodyData.identities[ENTRA_ID_IDENTITY];
    return entraIdBodyToUser(
      identity,
      bodyData.id,
      bodyData.primaryEmail,
      bodyData.name,
    );
  }

  const defaultResponse = {
    id: bodyData.id as string,
    email: bodyData.primaryEmail,
    primaryUserId: bodyData.id,
    createdAt: getCurrentUTCDate(),
    organizationId: bodyData.customData?.organizationId,
    profileImportId: bodyData.customData?.profileImportId,
    consentStatusOnDirectSignin: ConsentStatuses.Undefined,
  };

  const hasIdentities =
    bodyData.identities && Object.keys(bodyData.identities).length > 0;
  // If the user has logged in via an OTP enabled application, set consent status to pre-approved
  if (
    !hasIdentities &&
    otpApplicationIds.includes(bodyData.applicationId ?? "")
  ) {
    return {
      ...defaultResponse,
      consentStatusOnDirectSignin: ConsentStatuses.PreApproved,
    };
  }

  return defaultResponse;
};

const myGovIdBodyToUser = (
  identity: InputIdentity,
  userId: string,
  primaryEmail: string | null | undefined,
): WebhookUser => {
  const details = identity.details;
  return {
    id: userId,
    details: {
      firstName: (details.rawData.firstName ??
        details.rawData.givenName) as string,
      lastName: (details.rawData.lastName ?? details.rawData.surname) as string,
      email: (details.email ?? primaryEmail) as string,
      ppsn: (details.rawData.PublicServiceNumber as string) || undefined,
      dateOfBirth: details.rawData.BirthDate
        ? (details.rawData.BirthDate as string)
        : undefined,
      phone: details.rawData.mobile
        ? (details.rawData.mobile as string)
        : undefined,
    },
    email: (details.email ?? primaryEmail) as string,
    primaryUserId: userId,
    createdAt: getCurrentUTCDate(),
    consentStatusOnDirectSignin: ConsentStatuses.Undefined,
  };
};

const getNamesForEntra = (
  identity: InputIdentity,
  bodyUserName: string | null | undefined,
): { firstName: string; lastName: string } => {
  const validName = (identity.details.name ??
    identity.details.rawData.displayName ??
    bodyUserName) as string;
  let fullNameEntries = validName.split(" ");
  if (fullNameEntries.length === 0) {
    fullNameEntries = ["Not", "Defined"];
  }
  if (fullNameEntries.length === 1 && fullNameEntries[0].length === 0) {
    fullNameEntries = ["Not", "Defined"];
  }
  if (fullNameEntries.length === 1) {
    fullNameEntries.push("N/D");
  }
  const firstName = fullNameEntries.splice(0, 1)[0];
  const lastName = fullNameEntries.join(" ");

  return { firstName, lastName };
};

const entraIdBodyToUser = (
  identity: InputIdentity,
  userId: string,
  primaryEmail: string | null | undefined,
  bodyUserName: string | null | undefined,
): WebhookUser => {
  const details = identity.details;
  const { firstName, lastName } = getNamesForEntra(identity, bodyUserName);
  return {
    id: userId,
    details: {
      firstName,
      lastName,
      email: (details.email ?? primaryEmail) as string,
      dateOfBirth: undefined,
      phone: undefined,
    },
    email: (details.email ?? primaryEmail) as string,
    primaryUserId: userId,
    createdAt: getCurrentUTCDate(),
    consentStatusOnDirectSignin: ConsentStatuses.OptedIn,
  };
};
