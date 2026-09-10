import {
  type DefinedServices,
  getBuildingBlockSDK,
  type TokenFunction,
} from "@ogcio/building-blocks-sdk"
import type { EnvConfig } from "@/utils/env"
import { AppHttp } from "./http"

export type SupportSdks = DefinedServices<{
  services: {
    profile: {
      baseUrl: string
    }
    auditCollector: {
      baseUrl: string
    }
  }
  getTokenFn: TokenFunction
}>

// Both services accept the platform-admin M2M token.
const tokenServices = ["profile", "auditCollector"]

let supportSdk: SupportSdks | null = null

export const getSupportSdk = (config: EnvConfig): SupportSdks => {
  if (supportSdk) {
    return supportSdk
  }

  supportSdk = getBuildingBlockSDK({
    services: {
      profile: {
        baseUrl: config.PROFILE_API_RESOURCE_URL,
      },
      auditCollector: {
        baseUrl: config.AUDIT_API_URL,
      },
    },
    getTokenFn: async (serviceName: string) => {
      if (!tokenServices.includes(serviceName)) {
        throw new Error(
          `Wrong method invoked, ${tokenServices.join(", ")} only`,
        )
      }
      const tokenResult = await AppHttp.fetchAppM2MToken()
      if (!tokenResult.success) {
        throw new Error(
          `Failed to get token for service ${serviceName}: ${tokenResult.error}`,
        )
      }
      return tokenResult.value
    },
  })

  return supportSdk
}
