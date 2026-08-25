import { describe, expect, it, vi } from "vitest";
import { withOrganizationId } from "~/utils/with-organization-id.js";

vi.mock("@fastify/sensible", () => ({
  httpErrors: {
    forbidden: vi.fn((message) => new Error(message)),
  },
}));

describe("withOrganizationId", () => {
  it("should return organization id when present", () => {
    const request = {
      userData: {
        organizationId: "org-123",
      },
    };

    const result = withOrganizationId(request);
    expect(result).toBe("org-123");
  });

  it("should throw forbidden error when userData is undefined", () => {
    const request = {};

    expect(() => withOrganizationId(request)).toThrow(
      "Organization id is not set",
    );
  });

  it("should throw forbidden error when organizationId is undefined", () => {
    const request = {
      userData: {},
    };

    expect(() => withOrganizationId(request)).toThrow(
      "Organization id is not set",
    );
  });

  it("should throw forbidden error when organizationId is empty", () => {
    const request = {
      userData: {
        organizationId: "",
      },
    };

    expect(() => withOrganizationId(request)).toThrow(
      "Organization id is not set",
    );
  });
});
