import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENTRA_ID_IDENTITY, MY_GOV_ID_IDENTITY } from "~/const/logto.js";
import { ConsentStatuses } from "~/schemas/consents/shared.js";
import { webhookBodyToUser } from "~/services/webhooks/webhook-body-to-user.js";

describe("webhookBodyToUser", () => {
  const mockDate = "2024-01-01T00:00:00.000Z";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(mockDate));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should handle MyGovID identity data", () => {
    const webhookBody = {
      id: "user-123",
      primaryEmail: "test@example.com",
      identities: {
        [MY_GOV_ID_IDENTITY]: {
          details: {
            email: "john@example.com",
            rawData: {
              firstName: "John",
              lastName: "Doe",
            },
          },
        },
      },
      customData: {
        organizationId: "org-123",
        profileImportId: "job-123",
      },
    };

    const result = webhookBodyToUser(webhookBody, []);

    expect(result).toEqual({
      id: "user-123",
      details: {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      },
      email: "john@example.com",
      primaryUserId: "user-123",
      createdAt: mockDate,
      consentStatusOnDirectSignin: ConsentStatuses.Undefined,
    });
  });

  it("should handle MyGovID identity with givenName/surname", () => {
    const webhookBody = {
      id: "user-123",
      primaryEmail: "test@example.com",
      identities: {
        [MY_GOV_ID_IDENTITY]: {
          details: {
            email: "john@example.com",
            rawData: {
              givenName: "John",
              surname: "Doe",
            },
          },
        },
      },
    };

    const result = webhookBodyToUser(webhookBody, []);

    expect(result.details).toEqual({
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
    });
  });

  it("should handle non-MyGovID data", () => {
    const webhookBody = {
      id: "user-123",
      primaryEmail: "john@example.com",
      identities: {},
      customData: {
        organizationId: "org-123",
        profileImportId: "job-123",
      },
    };

    const result = webhookBodyToUser(webhookBody, []);

    expect(result).toEqual({
      id: "user-123",
      email: "john@example.com",
      primaryUserId: "user-123",
      createdAt: mockDate,
      organizationId: "org-123",
      profileImportId: "job-123",
      consentStatusOnDirectSignin: ConsentStatuses.Undefined,
    });
  });

  it("should handle non-MyGovID data through OTP application", () => {
    const webhookBody = {
      id: "user-123",
      primaryEmail: "john@example.com",
      identities: {},
      customData: {
        organizationId: "org-123",
        profileImportId: "job-123",
      },
      applicationId: "otp-testing-app-one",
    };

    const result = webhookBodyToUser(webhookBody, [
      "otp-testing-app-one",
      "otp-testing-app-two",
    ]);

    expect(result).toEqual({
      id: "user-123",
      email: "john@example.com",
      primaryUserId: "user-123",
      createdAt: mockDate,
      organizationId: "org-123",
      profileImportId: "job-123",
      consentStatusOnDirectSignin: ConsentStatuses.PreApproved,
    });
  });

  it("should handle missing customData", () => {
    const webhookBody = {
      id: "user-123",
      primaryEmail: "john@example.com",
      identities: {},
    };

    const result = webhookBodyToUser(webhookBody, []);

    expect(result.organizationId).toBeUndefined();
    expect(result.profileImportId).toBeUndefined();
  });

  const getEntraIdBody = () => ({
    id: "m4y9jvzar48a",
    name: "Main",
    avatar: null,
    profile: {},
    username: null,
    createdAt: 1731335457731,
    updatedAt: 1739519576475,
    customData: {},
    identities: {
      "OGCIO EntraID": {
        userId: "56d7937b-ccd4-407f-828a-6e009a11e21D",
        details: {
          id: "56d7937b-ccd4-407f-828a-6e009a11e21d",
          name: "Bob Ross",
          email: "bob.ross@nearform.com",
          rawData: {
            id: "56d7937b-ccd4-407f-828a-6e009a11e21D",
            mail: null,
            surname: null,
            jobTitle: null,
            givenName: null,
            displayName: "Display Name",
            mobilePhone: null,
            "@odata.context":
              "https://graph.microsoft.com/v1.0/$metadata#users/$entity",
            businessPhones: [],
            officeLocation: null,
            preferredLanguage: null,
            userPrincipalName: "bob.ross@nearform.com",
          },
        },
      },
    },
    primaryEmail: "primary.ross@nearform.com",
  });

  it("should handle EntraId identity data with details values", () => {
    const webhookBody = getEntraIdBody();

    const result = webhookBodyToUser(webhookBody, []);

    expect(result).toEqual({
      id: webhookBody.id,
      details: {
        firstName: "Bob",
        lastName: "Ross",
        email: "bob.ross@nearform.com",
      },
      email: "bob.ross@nearform.com",
      primaryUserId: webhookBody.id,
      createdAt: mockDate,
      consentStatusOnDirectSignin: ConsentStatuses.OptedIn,
    });
  });

  it("should handle EntraId identity data without details values", () => {
    // biome-ignore lint/suspicious/noExplicitAny: For testing needs
    const webhookBody = getEntraIdBody() as any;
    webhookBody.identities[ENTRA_ID_IDENTITY].details.name = undefined;
    webhookBody.identities[ENTRA_ID_IDENTITY].details.rawData.displayName =
      undefined;
    webhookBody.identities[ENTRA_ID_IDENTITY].details.email = undefined;

    const result = webhookBodyToUser(webhookBody, []);

    expect(result).toEqual({
      id: webhookBody.id,
      details: {
        firstName: "Main",
        lastName: "N/D",
        email: webhookBody.primaryEmail,
      },
      email: webhookBody.primaryEmail,
      primaryUserId: webhookBody.id,
      createdAt: mockDate,
      consentStatusOnDirectSignin: ConsentStatuses.OptedIn,
    });
  });
});
