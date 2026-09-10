import { describe, expect, it } from "vitest";
import { privateDetailsRequested } from "~/routes/profiles/shared.js";

const base = {
  userData: { userId: "user-1", organizationId: undefined },
  requestProfileId: undefined,
  queryOrganizationId: undefined,
  queryPrivateDetails: undefined,
  hasSuperAdminPermission: false,
} as const;

describe("privateDetailsRequested", () => {
  it("rejects asking for private and organization details together", async () => {
    await expect(
      privateDetailsRequested({
        ...base,
        queryPrivateDetails: "true",
        queryOrganizationId: "org-1",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("grants a public servant their own private details unless an org filter is set", async () => {
    const ownProfile = {
      ...base,
      userData: { userId: "user-1", organizationId: "org-1" },
      requestProfileId: "user-1",
    };

    await expect(privateDetailsRequested(ownProfile)).resolves.toBe(true);
    await expect(
      privateDetailsRequested({ ...ownProfile, queryOrganizationId: "org-2" }),
    ).resolves.toBe(false);
    await expect(
      privateDetailsRequested({
        ...ownProfile,
        queryOrganizationId: "org-2",
        queryPrivateDetails: "true",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("grants a citizen private details only without an org filter", async () => {
    await expect(privateDetailsRequested({ ...base })).resolves.toBe(true);
    await expect(
      privateDetailsRequested({ ...base, queryOrganizationId: "org-1" }),
    ).resolves.toBe(false);
  });

  it("returns false for a public servant who did not ask for private details", async () => {
    await expect(
      privateDetailsRequested({
        ...base,
        userData: { userId: "user-1", organizationId: "org-1" },
        requestProfileId: "someone-else",
      }),
    ).resolves.toBe(false);
  });

  it("requires super admin permission for private details of others", async () => {
    const asAdmin = {
      ...base,
      userData: { userId: "user-1", organizationId: "org-1" },
      requestProfileId: "someone-else",
      queryPrivateDetails: "true" as const,
    };

    await expect(privateDetailsRequested(asAdmin)).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(
      privateDetailsRequested({ ...asAdmin, hasSuperAdminPermission: true }),
    ).resolves.toBe(true);
  });
});
