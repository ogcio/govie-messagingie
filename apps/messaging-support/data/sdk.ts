import {
  type DefinedServices,
  getBuildingBlockSDK,
  type TokenFunction,
} from "@ogcio/building-blocks-sdk"
import type { EnvConfig } from "@/utils/env"
import { AppHttp } from "./http"

type SupportSdks = DefinedServices<{
  services: {
    profile: {
      baseUrl: string
    }
  }
  getTokenFn: TokenFunction
}>

let supportSdk: SupportSdks | null = null

export const getSupportSdk = (config: EnvConfig): SupportSdks => {
  supportSdk = getBuildingBlockSDK({
    services: {
      profile: {
        baseUrl: config.PROFILE_API_RESOURCE_URL,
      },
    },
    getTokenFn: async (serviceName: string) => {
      if (serviceName !== "profile") {
        throw new Error("Wrong method invoked, profile only");
      }
      const tokenResult = await AppHttp.fetchAppM2MToken()
      if (!tokenResult.success) {
        throw new Error(`Failed to get token for service ${serviceName}: ${tokenResult.error}`)
      }
      return tokenResult.value;
    },
  });

  return supportSdk
}
