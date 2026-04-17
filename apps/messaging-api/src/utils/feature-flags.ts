import type { BuildingBlocksSDK } from "@ogcio/building-blocks-sdk";
import type { EnvConfig } from "../plugins/external/env.js";
import { getFeatureFlagsClient } from "./authentication-factory.js";

export class FeatureFlagsWrapper {
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: Let's keep the abstraction pipeline until we use another feature flag in the future.
  private readonly featureFlagsClient: BuildingBlocksSDK["featureFlags"];
  constructor(ffConfig: { url: string; token: string }) {
    this.featureFlagsClient = getFeatureFlagsClient(ffConfig);
  }
}

export const shouldUseFeatureFlags = (config: EnvConfig) => {
  return (
    config.FEATURE_FLAGS_URL &&
    config.FEATURE_FLAGS_URL.length > 0 &&
    config.FEATURE_FLAGS_TOKEN &&
    config.FEATURE_FLAGS_TOKEN.length > 0
  );
};
