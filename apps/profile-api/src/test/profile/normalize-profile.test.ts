import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { ImportProfilesImportTypesEnum } from "~/schemas/profiles/import-profiles.js";
import type {
  KnownProfileDataDetails,
  PpsnOnlyProfileDataDetails,
} from "~/schemas/profiles/model.js";
import {
  normalizePpsnOnlyProfile,
  normalizeProfile,
  normalizeProfiles,
} from "~/services/profiles/normalize-profile.js";

// Helper function to generate expected values using the same hash algorithm
const getExpectedHashedValues = (ppsn: string) => {
  const hash = crypto.createHash("sha256").update(ppsn).digest("hex");
  const emailId = hash.substring(0, 10);
  const nameId = hash.substring(0, 8);
  return {
    email: `user-${emailId}@interim.gov.ie`,
    publicName: `User-${nameId}`,
  };
};

describe("normalizeProfile", () => {
  it("should normalize email to lowercase and PPSN to uppercase", () => {
    const input: KnownProfileDataDetails = {
      firstName: "John",
      lastName: "Doe",
      email: "JOHN.DOE@EXAMPLE.COM",
      ppsn: "1234567t",
    };

    const result = normalizeProfile(input);

    expect(result).toEqual({
      ...input,
      email: "john.doe@example.com",
      ppsn: "1234567T",
    });
  });

  it("should handle undefined PPSN", () => {
    const input: KnownProfileDataDetails = {
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@example.com",
    };

    const result = normalizeProfile(input);

    expect(result).toEqual({
      ...input,
      ppsn: undefined,
    });
  });

  it("should handle empty PPSN", () => {
    const input: KnownProfileDataDetails = {
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@example.com",
      ppsn: "",
    };

    const result = normalizeProfile(input);

    expect(result).toEqual({
      ...input,
      ppsn: undefined,
    });
  });
});

describe("normalizePpsnOnlyProfile", () => {
  it("should generate email and public name from PPSN", () => {
    const input: PpsnOnlyProfileDataDetails = {
      ppsn: "1234567T",
    };

    const result = normalizePpsnOnlyProfile(input);
    const expected = getExpectedHashedValues("1234567T");

    expect(result).toEqual({
      firstName: expected.publicName,
      lastName: expected.publicName,
      email: expected.email,
      ppsn: "1234567T",
    });
  });

  it("should throw error if PPSN is missing", () => {
    const input: Partial<PpsnOnlyProfileDataDetails> = {};

    expect(() =>
      normalizePpsnOnlyProfile(input as PpsnOnlyProfileDataDetails),
    ).toThrow("PPSN is required for PPSN-only profile imports");
  });

  it("should throw error if PPSN is empty", () => {
    const input: PpsnOnlyProfileDataDetails = {
      ppsn: "",
    };

    expect(() => normalizePpsnOnlyProfile(input)).toThrow(
      "PPSN is required for PPSN-only profile imports",
    );
  });

  it("should normalize PPSN to uppercase", () => {
    const input: PpsnOnlyProfileDataDetails = {
      ppsn: "1234567t",
    };

    const result = normalizePpsnOnlyProfile(input);

    expect(result.ppsn).toBe("1234567T");
  });
});

describe("normalizeProfiles", () => {
  it("should normalize multiple profiles with full import type", () => {
    const inputs: KnownProfileDataDetails[] = [
      {
        firstName: "John",
        lastName: "Doe",
        email: "JOHN.DOE@EXAMPLE.COM",
        ppsn: "1234567t",
      },
      {
        firstName: "Jane",
        lastName: "Smith",
        email: "JANE.SMITH@EXAMPLE.COM",
        ppsn: "7654321t",
      },
    ];

    const results = normalizeProfiles(
      inputs,
      ImportProfilesImportTypesEnum.Full,
    );

    expect(results).toEqual([
      {
        ...inputs[0],
        email: "john.doe@example.com",
        ppsn: "1234567T",
      },
      {
        ...inputs[1],
        email: "jane.smith@example.com",
        ppsn: "7654321T",
      },
    ]);
  });

  it("should normalize multiple profiles with PPSN-only import type", () => {
    const inputs: Partial<KnownProfileDataDetails>[] = [
      {
        ppsn: "1234567t",
      },
      {
        ppsn: "7654321t",
      },
    ];

    const results = normalizeProfiles(
      inputs as KnownProfileDataDetails[],
      ImportProfilesImportTypesEnum.PpsnOnly,
    );

    const expected1 = getExpectedHashedValues("1234567T");
    const expected2 = getExpectedHashedValues("7654321T");

    expect(results).toEqual([
      {
        firstName: expected1.publicName,
        lastName: expected1.publicName,
        email: expected1.email,
        ppsn: "1234567T",
      },
      {
        firstName: expected2.publicName,
        lastName: expected2.publicName,
        email: expected2.email,
        ppsn: "7654321T",
      },
    ]);
  });

  it("should use full import type by default", () => {
    const inputs: KnownProfileDataDetails[] = [
      {
        firstName: "John",
        lastName: "Doe",
        email: "JOHN.DOE@EXAMPLE.COM",
        ppsn: "1234567t",
      },
    ];

    const results = normalizeProfiles(inputs);

    expect(results).toEqual([
      {
        ...inputs[0],
        email: "john.doe@example.com",
        ppsn: "1234567T",
      },
    ]);
  });
});
