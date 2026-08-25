import { getAccessToken } from "@ogcio/api-auth";
import { MY_GOV_ID_IDENTITY } from "~/const/logto.js";
import type { LogtoManagementConfig } from "~/plugins/external/env.js";
import { withRetry } from "~/utils/with-retry.js";

export type SignInLogEntry = {
  payload: {
    interaction?: {
      verificationRecords?: Array<{
        connectorId?: string;
        socialUserInfo?: {
          rawData?: { DSPOnlineLevel?: number | string };
        };
      }>;
      identifiers?: Array<{
        connectorId?: string;
        userInfo?: {
          rawData?: { DSPOnlineLevel?: number | string };
        };
      }>;
    };
  };
};

export type GetUserResponse = {
  id: string;
  lastSignInAt: string | null;
  identities: {
    [MY_GOV_ID_IDENTITY]?: {
      userId: string;
      details: {
        id: string;
        rawData: {
          DSPOnlineLevel: string;
        };
      };
    };
  };
};

export type GetRolesForUserResponse = Array<{
  tenantId: string;
  id: string;
  name: string;
  description: string;
  type: string;
  isDefault: boolean;
}>;

export type OrganizationColor = {
  primaryColor: string;
  isDarkModeEnabled: boolean;
  darkPrimaryColor: string;
};

export type OrganizationBranding = {
  logoUrl: string;
  darkLogoUrl: string;
  favicon: string;
  darkFavicon: string;
};

export type SeededOrganizationCustomData = {
  allowMyGovId?: boolean; //Custom field coming from the seeded data
};

export type OrganizationCustomData = SeededOrganizationCustomData & {
  [key: string]: unknown;
};

export type Organization = {
  tenantId: string;
  id: string;
  name: string;
  description: string;
  customData: OrganizationCustomData;
  isMfaRequired: boolean;
  color: OrganizationColor;
  branding: OrganizationBranding;
  customCss: string;
  createdAt: number;
};

export type LogtoErrorBody = {
  message: string;
  code: string;
};
export class LogtoError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: LogtoErrorBody | unknown,
  ) {
    super(message);
  }
}

export class LogtoClient {
  private baseUrl: string;
  private defaultOptions: RequestInit;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.defaultOptions = {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    };
  }

  private async handleResponse(response: Response) {
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      switch (response.status) {
        case 400:
          throw new LogtoError("Invalid request parameters", 400, body);
        case 401:
          throw new LogtoError("Authentication required", 401, body);
        case 403:
          throw new LogtoError("Insufficient permissions", 403, body);
        case 404:
          throw new LogtoError("Resource not found", 404, body);
        case 422:
          throw new LogtoError("Invalid request data", 422, body);
        default:
          throw new LogtoError("Unknown error occurred", response.status, body);
      }
    }

    return response.json();
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    return withRetry(
      async (signal: AbortSignal) => {
        const response = await fetch(`${this.baseUrl}/${path}`, {
          ...this.defaultOptions,
          ...options,
          signal,
        });
        return this.handleResponse(response) as T;
      },
      {
        isRetryable: (error) =>
          !(error instanceof LogtoError && error.status < 500),
      },
    );
  }

  async createUser(userData: {
    primaryEmail: string;
    username?: string;
    name: string;
    customData: Record<string, unknown>;
  }) {
    return this.request<{ id: string; primaryEmail: string }>("users", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  async getUser(userId: string): Promise<GetUserResponse> {
    return this.request<GetUserResponse>(`users/${userId}`, {
      method: "GET",
    });
  }

  async getUserRoles(userId: string): Promise<GetRolesForUserResponse> {
    return this.request<GetRolesForUserResponse>(`users/${userId}/roles`, {
      method: "GET",
    });
  }

  async getOrganization(organizationId: string): Promise<Organization> {
    return this.request<Organization>(`organizations/${organizationId}`, {
      method: "GET",
    });
  }

  async getUserSignInLogs(userId: string): Promise<SignInLogEntry[]> {
    const response = await fetch(
      `${this.baseUrl}/logs?logKey=Interaction.SignIn.Submit&userId=${userId}&page_size=1`,
      { ...this.defaultOptions, method: "GET" },
    );
    if (!response.ok) return [];
    return (await response.json()) as SignInLogEntry[];
  }

  async assignUserRole(userId: string, roleId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/users/${userId}/roles`, {
      ...this.defaultOptions,
      method: "POST",
      body: JSON.stringify({ roleIds: [roleId] }),
    });
    if (!response.ok && response.status !== 409) {
      const body = await response.json().catch(() => ({}));
      throw new LogtoError(
        `Failed to assign role ${roleId} to user ${userId}`,
        response.status,
        body,
      );
    }
  }

  /**
   * Idempotent: no-op when the user does not hold the role (404).
   */
  async removeUserRole(userId: string, roleId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/users/${userId}/roles/${roleId}`,
      {
        ...this.defaultOptions,
        method: "DELETE",
      },
    );
    if (!response.ok && response.status !== 404) {
      const body = await response.json().catch(() => ({}));
      throw new LogtoError(
        `Failed to remove role ${roleId} from user ${userId}`,
        response.status,
        body,
      );
    }
  }

  async deleteUser(userId: string): Promise<void> {
    // use directly fetch here because request expects a JSON response
    const response = await fetch(`${this.baseUrl}/users/${userId}`, {
      ...this.defaultOptions,
      method: "DELETE",
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new LogtoError(
        `Failed to delete user with ID ${userId}`,
        response.status,
        body,
      );
    }
  }
}

export async function buildLogtoClient(
  config: LogtoManagementConfig,
): Promise<LogtoClient> {
  return new LogtoClient(
    config.LOGTO_MANAGEMENT_API_ENDPOINT,
    await getAccessToken({
      resource: config.LOGTO_MANAGEMENT_API_RESOURCE_URL,
      scopes: ["all"],
      applicationId: config.LOGTO_MANAGEMENT_API_CLIENT_ID,
      applicationSecret: config.LOGTO_MANAGEMENT_API_CLIENT_SECRET,
      logtoOidcEndpoint: config.LOGTO_OIDC_ENDPOINT,
    }),
  );
}

// Maintained for future reference
/**
 * Get user from Logto response example:
 * {
  "id": "{{logto-user-id}}",
  "username": null,
  "primaryEmail": "email@address.com",
  "primaryPhone": "+3123212345673621918",
  "name": "FULL NAME",
  "avatar": null,
  "customData": {},
  "identities": {
    "MyGovId (MyGovId connector)": {
      "userId": "{{ MY GOV ID USER ID }}",
      "details": {
        "id": "{{ MY GOV ID USER ID }}",
        "name": "FULL NAME",
        "email": "email@address.com",
        "phone": "+3123212345673621918",
        "rawData": {
          "aud": "audience-mygovid",
          "exp": 1751815591,
          "iat": 1751813791,
          "iss": "https://issuer",
          "nbf": 1751813791,
          "oid": "{{ MY GOV ID OID }}",
          "sub": "{{ MY GOV ID SUB }}",
          "ver": "1.0",
          "email": "email@address.com",
          "nonce": "nonce",
          "mobile": "+3123212345673621918",
          "surname": "surname",
          "lastName": "SURNAME",
          "BirthDate": "01/01/1900",
          "auth_time": 1234,
          "firstName": "NAME",
          "givenName": "Name",
          "CustomerId": "12345",
          "LastJourney": "Login",
          "AlternateIds": "{{ABC,DEF}}",
          "CorrelationId": "corr id",
          "RecoveryEmail": "address2@mail.com",
          "SMS2FAEnabled": false,
          "DSPOnlineLevel": "2",
          "Totp2FAEnabled": false,
          "currentCulture": "en",
          "PublicServiceNumber": "PPSN",
          "AcceptedPrivacyTerms": true,
          "DSPOnlineLevelStatic": "2",
          "trustFrameworkPolicy": "POLICY",
          "AcceptedPrivacyTermsDateTime": 32123,
          "AcceptedPrivacyTermsVersionNumber": "7"
        }
      }
    }
  },
  "lastSignInAt": 1754701713,
  "createdAt": 17518137912,
  "updatedAt": 175745401715,
  "profile": {},
  "applicationId": "1234432i19",
  "isSuspended": false,
  "hasPassword": false
};
 */

/*
Get roles for user example response
[
  {
    "tenantId": "default",
    "id": "bb-citizen",
    "name": "Citizen",
    "description": "A citizen using Life Events and the Building Blocks ecosystem",
    "type": "User",
    "isDefault": false
  },
  {
    "tenantId": "default",
    "id": "onboarded-citizen",
    "name": "Onboarded citizen",
    "description": "Role used to indicate if a citizen user is onboarded to the services suite",
    "type": "User",
    "isDefault": false
  };
];
*/
