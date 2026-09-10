import type { ExtractedUserData } from "@ogcio/api-auth";
import { describe, expect, it } from "vitest";
import { ensureUserIsOrganisationMember } from "../../utils/error-utils.js";
import { getPackageInfo } from "../../utils/get-package-info.js";
import { hasPermissions } from "../../utils/has-permissions.js";

function userWithScopes(scopes: string[]): ExtractedUserData {
  return { scopes } as ExtractedUserData;
}

describe("hasPermissions", () => {
  it("defaults to OR logic when no matchConfig is given", () => {
    expect(
      hasPermissions({
        userData: userWithScopes(["a"]),
        requestedScopes: ["a", "b"],
      }),
    ).toBe(true);
    expect(
      hasPermissions({
        userData: userWithScopes(["c"]),
        requestedScopes: ["a", "b"],
      }),
    ).toBe(false);
  });

  it("requires every scope with AND matching", () => {
    expect(
      hasPermissions({
        userData: userWithScopes(["a", "b"]),
        requestedScopes: ["a", "b"],
        matchConfig: { method: "AND" },
      }),
    ).toBe(true);
    expect(
      hasPermissions({
        userData: userWithScopes(["a"]),
        requestedScopes: ["a", "b"],
        matchConfig: { method: "AND" },
      }),
    ).toBe(false);
  });

  it("uses OR matching when matchConfig says OR", () => {
    expect(
      hasPermissions({
        userData: userWithScopes(["b"]),
        requestedScopes: ["a", "b"],
        matchConfig: { method: "OR" },
      }),
    ).toBe(true);
  });

  it("handles users without scopes", () => {
    expect(
      hasPermissions({
        userData: {} as ExtractedUserData,
        requestedScopes: ["a"],
      }),
    ).toBe(false);
  });
});

describe("ensureUserIsOrganisationMember", () => {
  it("returns the organization id when present", () => {
    expect(ensureUserIsOrganisationMember({ organizationId: "org-1" })).toBe(
      "org-1",
    );
  });

  it("throws forbidden when the user has no organization", () => {
    expect(() => ensureUserIsOrganisationMember(undefined)).toThrow(
      /part of an organisation/,
    );
    expect(() => ensureUserIsOrganisationMember({})).toThrow(
      /part of an organisation/,
    );
  });
});

describe("getPackageInfo", () => {
  it("reads name and version from the resolved package.json", async () => {
    const info = await getPackageInfo();
    expect(info.name).toEqual(expect.any(String));
    expect(info.version).toEqual(expect.any(String));
  });
});
