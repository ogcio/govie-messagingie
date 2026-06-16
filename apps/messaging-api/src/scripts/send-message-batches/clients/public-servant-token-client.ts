import type { PublicServantTokenClient } from "../domain/types.js";

interface TokenPayload {
  access_token: string;
  expires_in: number;
}

function isTokenPayload(value: unknown): value is TokenPayload {
  if (typeof value !== "object" || value == null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.access_token === "string" &&
    typeof candidate.expires_in === "number"
  );
}

function createTokenRequestError(
  message: string,
  status: number,
): Error & { status: number; statusCode: number } {
  const error = new Error(message) as Error & {
    status: number;
    statusCode: number;
  };
  error.status = status;
  error.statusCode = status;
  return error;
}

export function createPublicServantTokenClient(params: {
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
  organizationId: string;
  scopes: string;
  fetchFn?: typeof fetch;
  now?: () => Date;
}): PublicServantTokenClient {
  const fetchFn = params.fetchFn ?? fetch;
  const now = params.now ?? (() => new Date());

  let cachedToken:
    | {
        accessToken: string;
        expiresAt: number;
      }
    | undefined;

  return {
    async getAccessToken(): Promise<string> {
      const currentTime = now().valueOf();

      if (cachedToken && cachedToken.expiresAt > currentTime + 60_000) {
        return cachedToken.accessToken;
      }

      const credentials = Buffer.from(
        `${params.clientId}:${params.clientSecret}`,
      ).toString("base64");

      const response = await fetchFn(params.tokenEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          scope: params.scopes,
          organization_id: params.organizationId,
        }),
      });

      if (!response.ok) {
        throw createTokenRequestError(
          `Public servant token request failed with ${response.status}`,
          response.status,
        );
      }

      const payload = await response.json();
      if (!isTokenPayload(payload)) {
        throw new Error("Public servant token response was not valid");
      }

      cachedToken = {
        accessToken: payload.access_token,
        expiresAt: currentTime + payload.expires_in * 1000,
      };

      return payload.access_token;
    },
  };
}
