import { describe, expect, it } from "vitest";
import type { ProfileWithDetailsFromDb } from "~/schemas/profiles/model.js";
import {
  mergeProfileDataWithProfiles,
  parseProfileDbDetails,
  parseProfileDetails,
  parseProfileDetailsWithLinkedProfiles,
} from "~/schemas/profiles/shared.js";

const baseProfile = {
  id: "p1",
  publicName: "Jane Doe",
  email: "jane@example.com",
  primaryUserId: "p1",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  preferredLanguage: "en",
  status: "active",
} as unknown as Omit<ProfileWithDetailsFromDb, "profileDetailsId">;

const details = {
  firstName: { type: "string", value: "Jane" },
  lastName: { type: "string", value: "Doe" },
  email: { type: "string", value: "jane@example.com" },
} as unknown as ProfileWithDetailsFromDb["details"];

describe("parseProfileDetails", () => {
  it("returns undefined details when the profile has none", () => {
    const result = parseProfileDetails({ ...baseProfile, details: undefined });
    expect(result.details).toBeUndefined();
  });

  it("normalizes date details to ISO and keeps strings as-is", () => {
    const result = parseProfileDetails({
      ...baseProfile,
      details: {
        ...details,
        dateOfBirth: { type: "date", value: "1990-01-02" },
      } as unknown as ProfileWithDetailsFromDb["details"],
    });

    expect(result.details?.firstName).toBe("Jane");
    expect(result.details?.dateOfBirth).toContain("1990-01-02");
  });

  it("attaches linked profiles only when non-empty", () => {
    const linked = [{ id: "p2", publicName: "Kid" }];
    const withLinked = parseProfileDetails(
      { ...baseProfile, details },
      linked as never,
    );
    const withoutLinked = parseProfileDetails({ ...baseProfile, details }, []);

    expect(
      (withLinked as { linkedProfiles?: unknown[] }).linkedProfiles,
    ).toEqual(linked);
    expect(
      (withoutLinked as { linkedProfiles?: unknown[] }).linkedProfiles,
    ).toBeUndefined();
  });

  it("throws a 500 when a mandatory detail is missing", () => {
    expect(() =>
      parseProfileDetails({
        ...baseProfile,
        details: {
          firstName: { type: "string", value: "Jane" },
        } as unknown as ProfileWithDetailsFromDb["details"],
      }),
    ).toThrowError(expect.objectContaining({ statusCode: 500 }));
  });
});

describe("parseProfileDetailsWithLinkedProfiles", () => {
  it("returns the plain profile when there are no linked profiles", () => {
    const result = parseProfileDetailsWithLinkedProfiles(
      { ...baseProfile, details },
      [],
    );
    expect(result.linkedProfiles).toBeUndefined();
  });

  it("attaches linked profiles when present", () => {
    const linked = [{ id: "p2", publicName: "Kid" }];
    const result = parseProfileDetailsWithLinkedProfiles(
      { ...baseProfile, details },
      linked as never,
    );
    expect(result.linkedProfiles).toEqual(linked);
  });
});

describe("mergeProfileDataWithProfiles", () => {
  it("merges the detail map into each profile, falling back to profile email", () => {
    const profiles = [
      { ...baseProfile, profileDetailsId: "pd1" },
    ] as ProfileWithDetailsFromDb[];

    const result = mergeProfileDataWithProfiles(profiles, {
      pd1: { firstName: "Jane", lastName: "Doe" },
    });

    expect(result[0].details).toMatchObject({
      firstName: "Jane",
      lastName: "Doe",
      ppsn: "",
      email: "jane@example.com",
    });
  });

  it("prefers the detail email over the profile email", () => {
    const profiles = [
      { ...baseProfile, profileDetailsId: "pd1" },
    ] as ProfileWithDetailsFromDb[];

    const result = mergeProfileDataWithProfiles(profiles, {
      pd1: {
        firstName: "Jane",
        lastName: "Doe",
        ppsn: "1234567A",
        email: "detail@example.com",
      },
    });

    expect(result[0].details?.email).toBe("detail@example.com");
    expect(result[0].details?.ppsn).toBe("1234567A");
  });
});

describe("parseProfileDbDetails", () => {
  it("returns undefined for null or undefined input", () => {
    expect(parseProfileDbDetails(null)).toBeUndefined();
    expect(parseProfileDbDetails(undefined)).toBeUndefined();
  });

  it("normalizes date values and skips malformed entries", () => {
    const result = parseProfileDbDetails({
      firstName: { type: "string", value: "Jane" },
      dateOfBirth: { type: "date", value: "1990-01-02" },
      broken: "not-an-object" as never,
    });

    expect(result?.firstName).toBe("Jane");
    expect(result?.dateOfBirth).toContain("1990-01-02");
    expect(result && "broken" in result).toBe(false);
  });
});
