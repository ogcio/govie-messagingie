import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { LogtoClient } from "~/clients/logto.js";
import {
  CascadeConsentReasons,
  ConsentStatuses,
  ConsentSubjects,
} from "~/schemas/consents/shared.js";
import { getCurrentConsentStatement } from "~/services/consent-statements/consent-statements-service.js";
import {
  getLatestConsentForUser,
  submitConsent,
} from "~/services/consents/consents-service.js";
import { createUpdateProfileDetails } from "~/services/profiles/create-update-profile-details.js";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import { updateConsentStatuses } from "~/services/profiles/sql/update-consent-statuses.js";
import { updateProfile } from "~/services/profiles/update-profile.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { mockDbProfiles, mockLogger } from "~/test/fixtures/common.js";

describe("updateProfile", () => {
  const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
  let client: PoolClient;

  // Test data
  const profile1 = {
    ...mockDbProfiles[0],
    id: randomUUID().substring(0, 12),
    email: `${randomUUID().substring(0, 5)}@example.com`,
    primaryUserId: randomUUID().substring(0, 12),
  };

  const profile2 = {
    ...mockDbProfiles[1],
    id: randomUUID().substring(0, 12),
    email: `${randomUUID().substring(0, 5)}@example.com`,
    primaryUserId: randomUUID().substring(0, 12),
  };

  const orgId = randomUUID().substring(0, 11);

  // Mock Logto client
  const mockLogtoClient = {
    getUser: vi.fn(),
    createUser: vi.fn(),
  } as unknown as LogtoClient;

  const getLogtoClient = vi.fn().mockResolvedValue(mockLogtoClient);

  beforeAll(async () => {
    client = await pool.connect();

    // Create test profiles
    const profile1Id = await createProfile(client, profile1);
    const profile2Id = await createProfile(client, profile2);

    // Create profile details
    await createUpdateProfileDetails({
      client,
      organizationId: orgId,
      profileId: profile1Id,
      data: {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        phone: "1234567890",
      },
      createOnly: false,
    });

    await createUpdateProfileDetails({
      client,
      organizationId: orgId,
      profileId: profile2Id,
      data: {
        firstName: "Jane",
        lastName: "Smith",
        email: "jane.smith@example.com",
        phone: "0987654321",
      },
      createOnly: false,
    });

    // Add consent status
    await updateConsentStatuses({
      client,
      profileId: profile1Id,
      consentInput: {
        subject: ConsentSubjects.Messaging,
        status: ConsentStatuses.OptedIn,
        consentStatementId: randomUUID(),
      },
    });

    client.release();
  });

  afterAll(async () => {
    if (!pool.ended) {
      await pool.end();
    }
  });

  describe("updateMyProfile", () => {
    it("should update my own profile successfully", async () => {
      // Create a fresh profile for this test
      const testProfile = {
        ...mockDbProfiles[0],
        id: randomUUID().substring(0, 12),
        email: `${randomUUID().substring(0, 5)}@example.com`,
        primaryUserId: randomUUID().substring(0, 12),
      };

      const profileId = await createProfile(client, testProfile);

      await createUpdateProfileDetails({
        client,
        organizationId: orgId,
        profileId,
        data: {
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@example.com",
          phone: "1234567890",
        },
        createOnly: false,
      });

      const updateData = {
        publicName: "Updated Name",
        preferredLanguage: "ga" as const,
        firstName: "Updated",
        lastName: "Name",
        phone: "5555555555",
        email: `${randomUUID().substring(0, 5)}@example.com`,
      };

      const result = await updateProfile({
        logger: mockLogger,
        pool,
        updateRequestedById: testProfile.id,
        toUpdateProfileId: testProfile.id,
        toSetProfileData: updateData,
        organizationId: orgId,
        getLogtoClient,
      });

      expect(result.id).toEqual(testProfile.id);
      expect(result.publicName).toEqual("Updated Name");
      expect(result.email).toEqual(updateData.email);
      expect(result.preferredLanguage).toEqual("ga");
      expect(result.details?.firstName).toEqual("Updated");
      expect(result.details?.lastName).toEqual("Name");
      expect(result.details?.phone).toEqual("5555555555");
      expect(result.details?.email).toEqual(updateData.email);
    });

    it("should update my own profile without organization ID", async () => {
      // Create a fresh profile for this test
      const testProfile = {
        ...mockDbProfiles[0],
        id: randomUUID().substring(0, 12),
        email: `${randomUUID().substring(0, 5)}@example.com`,
        primaryUserId: randomUUID().substring(0, 12),
      };

      const profileId = await createProfile(client, testProfile);

      await createUpdateProfileDetails({
        client,
        organizationId: orgId,
        profileId,
        data: {
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@example.com",
          phone: "1234567890",
        },
        createOnly: false,
      });

      const updateData = {
        publicName: "Generic Update",
        firstName: "Generic",
        lastName: "Update",
        email: testProfile.email, // Include required email
      };

      const result = await updateProfile({
        logger: mockLogger,
        pool,
        updateRequestedById: testProfile.id,
        toUpdateProfileId: testProfile.id,
        toSetProfileData: updateData,
        organizationId: undefined,
        getLogtoClient,
      });

      expect(result.id).toEqual(testProfile.id);
      expect(result.publicName).toEqual("Generic Update");
      expect(result.email).toEqual(testProfile.email);
      expect(result.details?.firstName).toEqual("Generic");
      expect(result.details?.lastName).toEqual("Update");
      expect(result.details?.email).toEqual(testProfile.email);
    });

    it("should handle partial updates", async () => {
      // Create a fresh profile for this test
      const testProfile = {
        ...mockDbProfiles[0],
        id: randomUUID().substring(0, 12),
        email: `${randomUUID().substring(0, 5)}@example.com`,
        primaryUserId: randomUUID().substring(0, 12),
      };

      const profileId = await createProfile(client, testProfile);

      await createUpdateProfileDetails({
        client,
        organizationId: orgId,
        profileId,
        data: {
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@example.com",
          phone: "1234567890",
        },
        createOnly: false,
      });

      const updateData = {
        firstName: "Partial",
      };

      const result = await updateProfile({
        logger: mockLogger,
        pool,
        updateRequestedById: testProfile.id,
        toUpdateProfileId: testProfile.id,
        toSetProfileData: updateData,
        organizationId: orgId,
        getLogtoClient,
      });

      expect(result.id).toEqual(testProfile.id);
      expect(result.details?.firstName).toEqual("Partial");
      // Other fields should remain unchanged
      expect(result.details?.lastName).toEqual("Doe");
    });

    it("should throw error when profile not found", async () => {
      const updateData = {
        publicName: "Test",
      };

      await expect(
        updateProfile({
          logger: mockLogger,
          pool,
          updateRequestedById: "nonexistent-id",
          toUpdateProfileId: "nonexistent-id",
          toSetProfileData: updateData,
          organizationId: orgId,
          getLogtoClient,
        }),
      ).rejects.toThrow("Profile nonexistent-id not found");
    });

    it("should not update primary user id when updating own profile", async () => {
      // Create a fresh profile for this test
      const testProfile = {
        ...mockDbProfiles[0],
        id: randomUUID().substring(0, 12),
        email: `${randomUUID().substring(0, 5)}@example.com`,
        primaryUserId: randomUUID().substring(0, 12),
      };

      await createProfile(client, testProfile);

      const updateData = {
        publicName: "Test",
        primaryUserId: "new-primary-id",
      };

      const result = await updateProfile({
        logger: mockLogger,
        pool,
        updateRequestedById: testProfile.id,
        toUpdateProfileId: testProfile.id,
        toSetProfileData: updateData,
        organizationId: orgId,
        getLogtoClient,
      });

      // primaryUserId should not be updated
      expect(result.primaryUserId).toEqual(testProfile.primaryUserId);
      expect(result.publicName).toEqual("Test");
    });
  });

  describe("updateAnotherProfile", () => {
    it("should update another profile's primary user id successfully", async () => {
      // Create fresh profiles for this test
      const requesterProfile = {
        ...mockDbProfiles[0],
        id: randomUUID().substring(0, 12),
        email: `${randomUUID().substring(0, 5)}@example.com`,
        primaryUserId: randomUUID().substring(0, 12),
      };

      const targetProfile = {
        ...mockDbProfiles[1],
        id: randomUUID().substring(0, 12),
        email: `${randomUUID().substring(0, 5)}@example.com`,
        primaryUserId: randomUUID().substring(0, 12),
      };

      // Make sure requester's primaryUserId matches their id (they are the primary user)
      requesterProfile.primaryUserId = requesterProfile.id;
      // Make sure target profile is its own primary user
      targetProfile.primaryUserId = targetProfile.id;

      const requesterId = await createProfile(client, requesterProfile);
      const currentConsentStatement = await getCurrentConsentStatement({
        pool,
        subject: ConsentSubjects.Messaging,
      });
      await submitConsent({
        logger: mockLogger,
        pool,
        userId: requesterId,
        reason: CascadeConsentReasons.ExplicitSubmission,
        consentInput: {
          subject: ConsentSubjects.Messaging,
          status: ConsentStatuses.OptedIn,
          consentStatementId: currentConsentStatement.id,
        },
      });
      await createProfile(client, targetProfile);

      const updateData = {
        primaryUserId: requesterProfile.id,
      };

      const result = await updateProfile({
        logger: mockLogger,
        pool,
        updateRequestedById: requesterProfile.id,
        toUpdateProfileId: targetProfile.id,
        toSetProfileData: updateData,
        organizationId: undefined,
        getLogtoClient,
      });

      expect(result.id).toEqual(targetProfile.id);
      expect(result.primaryUserId).toEqual(requesterProfile.id);
      const latestChildConsent = await getLatestConsentForUser({
        pool,
        userId: targetProfile.id,
        subject: ConsentSubjects.Messaging,
      });
      expect(latestChildConsent.status).toEqual(ConsentStatuses.OptedIn);
      expect(latestChildConsent.consentStatementId).toEqual(
        currentConsentStatement.id,
      );
    });

    it("should throw error when trying to update organization data for another user", async () => {
      const updateData = {
        primaryUserId: profile1.id,
      };

      await expect(
        updateProfile({
          logger: mockLogger,
          pool,
          updateRequestedById: profile1.id,
          toUpdateProfileId: profile2.id,
          toSetProfileData: updateData,
          organizationId: orgId,
          getLogtoClient,
        }),
      ).rejects.toThrow(
        "Only generic data can be updated for another user, not organization related",
      );
    });

    it("should throw error when trying to update fields other than primaryUserId", async () => {
      const updateData = {
        primaryUserId: profile1.id,
        publicName: "Test",
      };

      await expect(
        updateProfile({
          logger: mockLogger,
          pool,
          updateRequestedById: profile1.id,
          toUpdateProfileId: profile2.id,
          toSetProfileData: updateData,
          organizationId: undefined,
          getLogtoClient,
        }),
      ).rejects.toThrow("For another user, only primary_user_id can be set");
    });

    it("should throw error when primaryUserId is not set", async () => {
      const updateData = {};

      await expect(
        updateProfile({
          logger: mockLogger,
          pool,
          updateRequestedById: profile1.id,
          toUpdateProfileId: profile2.id,
          toSetProfileData: updateData,
          organizationId: undefined,
          getLogtoClient,
        }),
      ).rejects.toThrow("For another user, only primary_user_id can be set");
    });

    it("should throw error when trying to set different primaryUserId", async () => {
      const updateData = {
        primaryUserId: "different-id",
      };

      await expect(
        updateProfile({
          logger: mockLogger,
          pool,
          updateRequestedById: profile1.id,
          toUpdateProfileId: profile2.id,
          toSetProfileData: updateData,
          organizationId: undefined,
          getLogtoClient,
        }),
      ).rejects.toThrow(
        "You can only set yourself as primary user id for another user",
      );
    });

    it("should throw error when to update profile not found", async () => {
      const updateData = {
        primaryUserId: profile1.id,
      };

      await expect(
        updateProfile({
          logger: mockLogger,
          pool,
          updateRequestedById: profile1.id,
          toUpdateProfileId: "nonexistent-id",
          toSetProfileData: updateData,
          organizationId: undefined,
          getLogtoClient,
        }),
      ).rejects.toThrow("To update profile not found");
    });

    it("should throw error when profile already logged in", async () => {
      // Create a target profile that has details (which triggers the "already logged in" check)
      const targetProfile = {
        ...mockDbProfiles[1],
        id: randomUUID().substring(0, 12),
        email: `${randomUUID().substring(0, 5)}@example.com`,
        primaryUserId: randomUUID().substring(0, 12),
      };

      // Make sure target profile is its own primary user
      targetProfile.primaryUserId = targetProfile.id;

      const targetId = await createProfile(client, targetProfile);

      // Create profile details to trigger the "already logged in" check
      await createUpdateProfileDetails({
        client,
        organizationId: undefined,
        profileId: targetId,
        data: {
          firstName: "Test",
          lastName: "User",
          email: "test@example.com",
        },
        createOnly: false,
      });

      // Mock Logto to return a user that has already signed in
      vi.mocked(mockLogtoClient.getUser).mockResolvedValue({
        id: targetProfile.id,
        lastSignInAt: new Date().toISOString(),
        identities: {},
      });

      const updateData = {
        primaryUserId: profile1.id,
      };

      await expect(
        updateProfile({
          logger: mockLogger,
          pool,
          updateRequestedById: profile1.id,
          toUpdateProfileId: targetProfile.id,
          toSetProfileData: updateData,
          organizationId: undefined,
          getLogtoClient,
        }),
      ).rejects.toThrow(
        "Cannot update data for a profile that already logged in",
      );

      // Reset mock
      vi.mocked(mockLogtoClient.getUser).mockResolvedValue({
        id: profile2.id,
        lastSignInAt: null,
        identities: {},
      });
    });

    it("should throw error when profile already has different primaryUserId", async () => {
      // Create a profile that already has a different primaryUserId
      const profileWithDifferentPrimary = {
        ...mockDbProfiles[0],
        id: randomUUID().substring(0, 12),
        email: `${randomUUID().substring(0, 5)}@example.com`,
        primaryUserId: "existing",
      };

      const profileId = await createProfile(
        client,
        profileWithDifferentPrimary,
      );

      const updateData = {
        primaryUserId: profile1.id,
      };

      await expect(
        updateProfile({
          logger: mockLogger,
          pool,
          updateRequestedById: profile1.id,
          toUpdateProfileId: profileId,
          toSetProfileData: updateData,
          organizationId: undefined,
          getLogtoClient,
        }),
      ).rejects.toThrow("Can't update primary user id for this profile");
    });

    it("should throw error when update requester not found", async () => {
      // Create a target profile that exists
      const targetProfile = {
        ...mockDbProfiles[1],
        id: randomUUID().substring(0, 12),
        email: `${randomUUID().substring(0, 5)}@example.com`,
        primaryUserId: randomUUID().substring(0, 12),
      };

      await createProfile(client, targetProfile);

      const updateData = {
        primaryUserId: "nonexistent-requester", // Match requester ID to avoid constraint
      };

      await expect(
        updateProfile({
          logger: mockLogger,
          pool,
          updateRequestedById: "nonexistent-requester",
          toUpdateProfileId: targetProfile.id,
          toSetProfileData: updateData,
          organizationId: undefined,
          getLogtoClient,
        }),
      ).rejects.toThrow("Can't update primary user id for this profile");
    });

    it("should throw error when update requester is a child profile", async () => {
      // Create a target profile that exists
      const targetProfile = {
        ...mockDbProfiles[1],
        id: randomUUID().substring(0, 12),
        email: `${randomUUID().substring(0, 5)}@example.com`,
        primaryUserId: randomUUID().substring(0, 12),
      };

      // Make sure target profile is its own primary user
      targetProfile.primaryUserId = targetProfile.id;

      await createProfile(client, targetProfile);

      // Create a child profile (has different primaryUserId)
      const childProfile = {
        ...mockDbProfiles[0],
        id: randomUUID().substring(0, 12),
        email: `${randomUUID().substring(0, 5)}@example.com`,
        primaryUserId: profile1.id, // This makes it a child
      };

      const childProfileId = await createProfile(client, childProfile);

      const updateData = {
        primaryUserId: childProfileId,
      };

      await expect(
        updateProfile({
          logger: mockLogger,
          pool,
          updateRequestedById: childProfileId,
          toUpdateProfileId: targetProfile.id,
          toSetProfileData: updateData,
          organizationId: undefined,
          getLogtoClient,
        }),
      ).rejects.toThrow(
        "You can't use your profile as primary user because it's already linked to a parent",
      );
    });

    it("should not update when primaryUserId already matches", async () => {
      // Create fresh profiles for this test
      const requesterProfile = {
        ...mockDbProfiles[0],
        id: randomUUID().substring(0, 12),
        email: `${randomUUID().substring(0, 5)}@example.com`,
        primaryUserId: randomUUID().substring(0, 12),
      };

      const targetProfile = {
        ...mockDbProfiles[1],
        id: randomUUID().substring(0, 12),
        email: `${randomUUID().substring(0, 5)}@example.com`,
        primaryUserId: randomUUID().substring(0, 12),
      };

      // Make sure requester's primaryUserId matches their id (they are the primary user)
      requesterProfile.primaryUserId = requesterProfile.id;
      // Make sure target profile is its own primary user
      targetProfile.primaryUserId = targetProfile.id;

      await createProfile(client, requesterProfile);
      await createProfile(client, targetProfile);

      const updateData = {
        primaryUserId: requesterProfile.id, // Set requester as primaryUserId to pass validation
      };

      const result = await updateProfile({
        pool,
        updateRequestedById: requesterProfile.id,
        toUpdateProfileId: targetProfile.id,
        toSetProfileData: updateData,
        organizationId: undefined,
        getLogtoClient,
        logger: mockLogger,
      });

      expect(result.id).toEqual(targetProfile.id);
      expect(result.primaryUserId).toEqual(requesterProfile.id);
    });

    it("should handle Logto client errors gracefully", async () => {
      // Create a target profile that has details (which triggers the Logto check)
      const targetProfile = {
        ...mockDbProfiles[1],
        id: randomUUID().substring(0, 12),
        email: `${randomUUID().substring(0, 5)}@example.com`,
        primaryUserId: randomUUID().substring(0, 12),
      };

      // Make sure target profile is its own primary user
      targetProfile.primaryUserId = targetProfile.id;

      const targetId = await createProfile(client, targetProfile);

      // Create profile details to trigger the Logto check
      await createUpdateProfileDetails({
        client,
        organizationId: undefined,
        profileId: targetId,
        data: {
          firstName: "Test",
          lastName: "User",
          email: "test@example.com",
        },
        createOnly: false,
      });

      // Mock Logto to throw an error
      vi.mocked(mockLogtoClient.getUser).mockRejectedValue(
        new Error("Logto error"),
      );

      const updateData = {
        primaryUserId: profile1.id,
      };

      await expect(
        updateProfile({
          logger: mockLogger,
          pool,
          updateRequestedById: profile1.id,
          toUpdateProfileId: targetProfile.id,
          toSetProfileData: updateData,
          organizationId: undefined,
          getLogtoClient,
        }),
      ).rejects.toThrow("Logto error");

      // Reset mock
      vi.mocked(mockLogtoClient.getUser).mockResolvedValue({
        id: profile2.id,
        lastSignInAt: null,
        identities: {},
      });
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle database connection errors", async () => {
      const invalidPool = {
        connect: vi.fn().mockRejectedValue(new Error("Connection failed")),
      } as unknown as typeof pool;

      const updateData = {
        publicName: "Test",
      };

      await expect(
        updateProfile({
          logger: mockLogger,
          pool: invalidPool,
          updateRequestedById: profile1.id,
          toUpdateProfileId: profile1.id,
          toSetProfileData: updateData,
          organizationId: orgId,
          getLogtoClient,
        }),
      ).rejects.toThrow("Connection failed");
    });

    it("should handle empty update data", async () => {
      // Create a fresh profile for this test
      const testProfile = {
        ...mockDbProfiles[0],
        id: randomUUID().substring(0, 12),
        email: `${randomUUID().substring(0, 5)}@example.com`,
        primaryUserId: randomUUID().substring(0, 12),
      };

      await createProfile(client, testProfile);

      const updateData = {};

      const result = await updateProfile({
        logger: mockLogger,
        pool,
        updateRequestedById: testProfile.id,
        toUpdateProfileId: testProfile.id,
        toSetProfileData: updateData,
        organizationId: orgId,
        getLogtoClient,
      });

      expect(result.id).toEqual(testProfile.id);
      // Should return the profile unchanged
    });
  });
});
