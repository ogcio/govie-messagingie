import { ConfidentialClientApplication } from "@azure/msal-node"
import { getEnvConfig } from "./utils/env"

let msalClient: ConfidentialClientApplication | null = null

export function buildMsalClient(): ConfidentialClientApplication {
  if (msalClient) {
    return msalClient
  }

  const { MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID } =
    getEnvConfig()

  msalClient = new ConfidentialClientApplication({
    auth: {
      clientId: MICROSOFT_CLIENT_ID,
      clientSecret: MICROSOFT_CLIENT_SECRET,
      authority: `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/v2.0`,
    },
  })

  return msalClient
}

export const msalScopes = ["openid", "profile", "email"]
