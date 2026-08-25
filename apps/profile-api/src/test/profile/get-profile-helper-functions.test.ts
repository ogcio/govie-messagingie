import { describe, expect, it } from "vitest";
import {
  type LinkedProfile,
  ProfileStatuses,
} from "~/schemas/profiles/model.js";
import {
  parseProfileDbDetails,
  parseProfileDetailsWithLinkedProfiles,
} from "~/schemas/profiles/shared.js";
import type { ProfileWithEnhancedConsent } from "~/services/profiles/sql/find-profile-with-enhanced-consent.js";

// Import the functions we want to test
// Note: These are internal functions, so we'll test them indirectly through the main getProfile function
// and also test the logic separately

describe("getProfile helper functions", () => {
  describe("parseProfileDetailsWithLinkedProfiles", () => {
    it("should parse profile with enhanced consent and no linked profiles", () => {
      // This test verifies the parsing logic indirectly through the main function
      const mockProfileWithEnhancedConsent: ProfileWithEnhancedConsent = {
        id: "test-profile-123",
        publicName: "Test User",
        email: "test@example.com",
        primaryUserId: "test-user-123",
        createdAt: "2023-01-01T00:00:00Z",
        updatedAt: "2023-01-02T00:00:00Z",
        preferredLanguage: "en",
        status: ProfileStatuses.Active,
        consentStatuses: {
          messaging: {
            subject: "messaging",
            status: "opted-in",
            submittedAt: "2023-01-01T10:00:00Z",
            statementId: "stmt-123",
            statementVersion: 1,
            isLatestStatement: true,
          },
        },
        details: {
          email: { value: "data@example.com", type: "string" },
          firstName: { value: "John", type: "string" },
          lastName: { value: "Doe", type: "string" },
          phone: { value: "123456789", type: "string" },
          city: { value: "Dublin", type: "string" },
          address: { value: "123 Main St", type: "string" },
          dateOfBirth: { value: "1990-01-01", type: "date" },
          ppsn: { value: "1234567A", type: "string" },
        },
      };

      const linkedProfiles: LinkedProfile[] = [];

      const result = parseProfileDetailsWithLinkedProfiles(
        mockProfileWithEnhancedConsent,
        linkedProfiles,
      );

      expect(result.id).toEqual("test-profile-123");
      expect(result.publicName).toEqual("Test User");
      expect(result.email).toEqual("data@example.com");
      expect(result.primaryUserId).toEqual("test-user-123");
      expect(result.preferredLanguage).toEqual("en");
      expect(result.consentStatuses).toEqual({
        messaging: {
          subject: "messaging",
          status: "opted-in",
          submittedAt: "2023-01-01T10:00:00Z",
          statementId: "stmt-123",
          statementVersion: 1,
          isLatestStatement: true,
        },
      });
      expect(result.details).toEqual({
        email: "data@example.com",
        firstName: "John",
        lastName: "Doe",
        phone: "123456789",
        city: "Dublin",
        address: "123 Main St",
        dateOfBirth: "1990-01-01T00:00:00.000Z",
        ppsn: "1234567A",
      });
      expect(result.linkedProfiles).toBeUndefined();
    });

    it("should parse profile with enhanced consent and linked profiles", () => {
      const mockProfileWithEnhancedConsent: ProfileWithEnhancedConsent = {
        id: "test-profile-123",
        status: ProfileStatuses.Active,
        publicName: "Test User",
        email: "test@example.com",
        primaryUserId: "test-user-123",
        createdAt: "2023-01-01T00:00:00Z",
        updatedAt: "2023-01-02T00:00:00Z",
        preferredLanguage: "en",
        consentStatuses: null,
        details: undefined,
      };

      const linkedProfiles: LinkedProfile[] = [
        {
          id: "linked-profile-1",
          publicName: "Linked User 1",
          email: "linked1@example.com",
        },
        {
          id: "linked-profile-2",
          publicName: "Linked User 2",
          email: "linked2@example.com",
        },
      ];

      const result = parseProfileDetailsWithLinkedProfiles(
        mockProfileWithEnhancedConsent,
        linkedProfiles,
      );

      expect(result.id).toEqual("test-profile-123");
      expect(result.consentStatuses).toBeNull();
      expect(result.details).toBeUndefined();
      expect(result.linkedProfiles).toHaveLength(2);
      expect(result.linkedProfiles?.[0].id).toEqual("linked-profile-1");
      expect(result.linkedProfiles?.[1].id).toEqual("linked-profile-2");
    });
  });

  describe("parseProfileDbDetails", () => {
    it("should parse string type details correctly", () => {
      const dbDetails = {
        firstName: { value: "John", type: "string" },
        lastName: { value: "Doe", type: "string" },
        email: { value: "john.doe@example.com", type: "string" },
      };

      const result = parseProfileDbDetails(dbDetails);

      expect(result).toEqual({
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
      });
    });

    it("should parse date type details correctly", () => {
      const dbDetails = {
        dateOfBirth: { value: "1990-01-01", type: "date" },
        registrationDate: { value: "2023-01-01", type: "date" },
      };

      const result = parseProfileDbDetails(dbDetails);

      expect(result).toEqual({
        dateOfBirth: "1990-01-01T00:00:00.000Z",
        registrationDate: "2023-01-01T00:00:00.000Z",
      });
    });

    it("should handle mixed type details", () => {
      const dbDetails = {
        firstName: { value: "John", type: "string" },
        dateOfBirth: { value: "1990-01-01", type: "date" },
        phone: { value: "123456789", type: "string" },
      };

      const result = parseProfileDbDetails(dbDetails);

      expect(result).toEqual({
        firstName: "John",
        dateOfBirth: "1990-01-01T00:00:00.000Z",
        phone: "123456789",
      });
    });

    it("should return undefined for null/undefined input", () => {
      expect(parseProfileDbDetails(null)).toBeUndefined();
      expect(parseProfileDbDetails(undefined)).toBeUndefined();
    });

    it("should handle empty details object", () => {
      const dbDetails = {};

      const result = parseProfileDbDetails(dbDetails);

      expect(result).toEqual({});
    });
  });
});
