import { describe, expect, it } from "vitest";
import {
  ConsentStatuses,
  isValidStatusTransition,
} from "~/schemas/consents/shared.js";

describe("Consent Status Transitions", () => {
  describe("isValidStatusTransition", () => {
    it("should allow any status for new consent (null fromStatus)", () => {
      expect(isValidStatusTransition(null, ConsentStatuses.Undefined)).toBe(
        true,
      );
      expect(isValidStatusTransition(null, ConsentStatuses.PreApproved)).toBe(
        true,
      );
      expect(isValidStatusTransition(null, ConsentStatuses.Pending)).toBe(true);
      expect(isValidStatusTransition(null, ConsentStatuses.OptedIn)).toBe(true);
      expect(isValidStatusTransition(null, ConsentStatuses.OptedOut)).toBe(
        true,
      );
    });

    it("should allow undefined to pending transition", () => {
      expect(
        isValidStatusTransition(
          ConsentStatuses.Undefined,
          ConsentStatuses.Pending,
        ),
      ).toBe(true);
    });

    it("should allow pending to opted-in transition", () => {
      expect(
        isValidStatusTransition(
          ConsentStatuses.Pending,
          ConsentStatuses.OptedIn,
        ),
      ).toBe(true);
    });

    it("should allow pending to opted-out transition", () => {
      expect(
        isValidStatusTransition(
          ConsentStatuses.Pending,
          ConsentStatuses.OptedOut,
        ),
      ).toBe(true);
    });

    it("should allow opted-in to opted-in transition (same status)", () => {
      expect(
        isValidStatusTransition(
          ConsentStatuses.OptedIn,
          ConsentStatuses.OptedIn,
        ),
      ).toBe(true);
    });

    it("should allow opted-in to opted-out transition", () => {
      expect(
        isValidStatusTransition(
          ConsentStatuses.OptedIn,
          ConsentStatuses.OptedOut,
        ),
      ).toBe(true);
    });

    it("should allow opted-out to opted-in transition", () => {
      expect(
        isValidStatusTransition(
          ConsentStatuses.OptedOut,
          ConsentStatuses.OptedIn,
        ),
      ).toBe(true);
    });

    it("should allow opted-out to opted-out transition (same status)", () => {
      expect(
        isValidStatusTransition(
          ConsentStatuses.OptedOut,
          ConsentStatuses.OptedOut,
        ),
      ).toBe(true);
    });

    it("should not allow undefined to opted-in transition", () => {
      expect(
        isValidStatusTransition(
          ConsentStatuses.Undefined,
          ConsentStatuses.OptedIn,
        ),
      ).toBe(false);
    });

    it("should not allow undefined to opted-out transition", () => {
      expect(
        isValidStatusTransition(
          ConsentStatuses.Undefined,
          ConsentStatuses.OptedOut,
        ),
      ).toBe(false);
    });

    it("should not allow pre-approved to pending transition", () => {
      expect(
        isValidStatusTransition(
          ConsentStatuses.PreApproved,
          ConsentStatuses.Pending,
        ),
      ).toBe(false);
    });

    it("should not allow pre-approved to undefined transition", () => {
      expect(
        isValidStatusTransition(
          ConsentStatuses.PreApproved,
          ConsentStatuses.Undefined,
        ),
      ).toBe(false);
    });

    it("should not allow pending to undefined transition", () => {
      expect(
        isValidStatusTransition(
          ConsentStatuses.Pending,
          ConsentStatuses.Undefined,
        ),
      ).toBe(false);
    });

    it("should not allow pending to pre-approved transition", () => {
      expect(
        isValidStatusTransition(
          ConsentStatuses.Pending,
          ConsentStatuses.PreApproved,
        ),
      ).toBe(false);
    });

    it("should not allow opted-in to undefined transition", () => {
      expect(
        isValidStatusTransition(
          ConsentStatuses.OptedIn,
          ConsentStatuses.Undefined,
        ),
      ).toBe(false);
    });

    it("should not allow opted-in to pre-approved transition", () => {
      expect(
        isValidStatusTransition(
          ConsentStatuses.OptedIn,
          ConsentStatuses.PreApproved,
        ),
      ).toBe(false);
    });

    it("should not allow opted-in to pending transition", () => {
      expect(
        isValidStatusTransition(
          ConsentStatuses.OptedIn,
          ConsentStatuses.Pending,
        ),
      ).toBe(false);
    });

    it("should not allow opted-out to undefined transition", () => {
      expect(
        isValidStatusTransition(
          ConsentStatuses.OptedOut,
          ConsentStatuses.Undefined,
        ),
      ).toBe(false);
    });

    it("should not allow opted-out to pre-approved transition", () => {
      expect(
        isValidStatusTransition(
          ConsentStatuses.OptedOut,
          ConsentStatuses.PreApproved,
        ),
      ).toBe(false);
    });

    it("should not allow opted-out to pending transition", () => {
      expect(
        isValidStatusTransition(
          ConsentStatuses.OptedOut,
          ConsentStatuses.Pending,
        ),
      ).toBe(false);
    });

    it("disallows staying in pending", () => {
      expect(
        isValidStatusTransition(
          ConsentStatuses.Pending,
          ConsentStatuses.Pending,
        ),
      ).toBe(false);
    });

    it("allows transition from pre approved to opted-in", () => {
      expect(
        isValidStatusTransition(
          ConsentStatuses.PreApproved,
          ConsentStatuses.OptedIn,
        ),
      ).toBe(true);
    });

    it("allows transition from pre approved to opted-out", () => {
      expect(
        isValidStatusTransition(
          ConsentStatuses.PreApproved,
          ConsentStatuses.OptedOut,
        ),
      ).toBe(true);
    });

    it("disallows staying in pre-approved", () => {
      expect(
        isValidStatusTransition(
          ConsentStatuses.PreApproved,
          ConsentStatuses.PreApproved,
        ),
      ).toBe(false);
    });

    it("should handle unknown status gracefully", () => {
      expect(
        isValidStatusTransition("unknown-status", ConsentStatuses.OptedIn),
      ).toBe(false);
    });
  });
});
