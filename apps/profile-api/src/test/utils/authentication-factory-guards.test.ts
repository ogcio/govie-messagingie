import { describe, expect, it } from "vitest";
import {
  ensureOrganizationIdIsSet,
  ensureUserIdIsSet,
  isOrganizationIdSet,
} from "~/utils/authentication-factory.js";

describe("authentication-factory guards", () => {
  describe("ensureUserIdIsSet", () => {
    it("returns the user id when set", () => {
      expect(ensureUserIdIsSet({ userData: { userId: "user-1" } })).toBe(
        "user-1",
      );
    });

    it("throws forbidden when userData is missing", () => {
      expect(() => ensureUserIdIsSet({})).toThrowError(
        expect.objectContaining({ statusCode: 403 }),
      );
    });

    it("throws forbidden when userId is missing", () => {
      expect(() => ensureUserIdIsSet({ userData: {} })).toThrowError(
        expect.objectContaining({ statusCode: 403 }),
      );
    });
  });

  describe("ensureOrganizationIdIsSet", () => {
    it("returns the organization id when set", () => {
      expect(
        ensureOrganizationIdIsSet({ userData: { organizationId: "org-1" } }),
      ).toBe("org-1");
    });

    it("throws forbidden when organizationId is missing", () => {
      expect(() => ensureOrganizationIdIsSet({ userData: {} })).toThrowError(
        expect.objectContaining({ statusCode: 403 }),
      );
    });
  });

  describe("isOrganizationIdSet", () => {
    it("returns true when set", () => {
      expect(
        isOrganizationIdSet({ userData: { organizationId: "org-1" } }),
      ).toBe(true);
    });

    it("returns false when missing", () => {
      expect(isOrganizationIdSet({})).toBe(false);
      expect(isOrganizationIdSet({ userData: {} })).toBe(false);
    });
  });
});
