import type { ExtractedUserData, MatchConfig } from "@ogcio/api-auth";

export function hasPermissions({
  userData,
  requestedScopes,
  matchConfig,
}: {
  userData: ExtractedUserData;
  requestedScopes: string[];
  matchConfig?: MatchConfig;
}) {
  // if matchConfig is not provided, default to OR logic
  // if matchConfig is AND, all requested scopes must be present in userData.permissions
  // if matchConfig is OR, at least one of the requested scopes must be present in userData.permissions
  const userPermissions = userData.scopes || [];
  if (matchConfig && matchConfig.method === "AND") {
    return requestedScopes.every((scope) => userPermissions.includes(scope));
  } else {
    return requestedScopes.some((scope) => userPermissions.includes(scope));
  }
}
