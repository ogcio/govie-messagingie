import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getProfilesFromCsv } from "~/services/profiles/get-profiles-from-csv.js";
import { mockProfiles } from "~/test/fixtures/common.js";

describe("getProfilesFromCsv", () => {
  const tempDir = path.join(os.tmpdir(), "profile-api-tests");

  beforeEach(async () => {
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("should successfully parse a valid CSV file", async () => {
    // Convert date to ISO format
    const profile1 = {
      ...mockProfiles[0],
      dateOfBirth: new Date(mockProfiles[0].dateOfBirth)
        .toISOString()
        .split("T")[0],
    };
    const profile2 = {
      ...mockProfiles[1],
      dateOfBirth: new Date(mockProfiles[1].dateOfBirth)
        .toISOString()
        .split("T")[0],
    };

    const csvContent = `firstName,lastName,email,phone,dateOfBirth,address,city,preferredLanguage
${profile1.firstName},${profile1.lastName},${profile1.email},${profile1.phone},${profile1.dateOfBirth},${profile1.address},${profile1.city},en
${profile2.firstName},${profile2.lastName},${profile2.email},${profile2.phone},${profile2.dateOfBirth},${profile2.address},${profile2.city},ga`;

    const filePath = path.join(tempDir, "valid.csv");
    await fs.writeFile(filePath, csvContent);

    const result = await getProfilesFromCsv(filePath);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      firstName: profile1.firstName,
      lastName: profile1.lastName,
      email: profile1.email,
      phone: profile1.phone,
      dateOfBirth: profile1.dateOfBirth,
      address: profile1.address,
      city: profile1.city,
      preferredLanguage: "en",
    });
  });

  it("should handle an externalId", async () => {
    const csvContent = `firstName,lastName,email,externalId
${mockProfiles[0].firstName},${mockProfiles[0].lastName},${mockProfiles[0].email},${mockProfiles[0].externalId}`;

    const filePath = path.join(tempDir, "externalId.csv");
    await fs.writeFile(filePath, csvContent);

    const result = await getProfilesFromCsv(filePath);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      firstName: mockProfiles[0].firstName,
      lastName: mockProfiles[0].lastName,
      email: mockProfiles[0].email,
      externalId: mockProfiles[0].externalId,
    });
  });

  it("should handle ppsn-only profiles", async () => {
    const csvContent = `ppsn
${mockProfiles[0].ppsn}`;

    const filePath = path.join(tempDir, "ppsn-only.csv");
    await fs.writeFile(filePath, csvContent);

    const result = await getProfilesFromCsv(filePath, "ppsn-only");

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      ppsn: mockProfiles[0].ppsn,
    });
  });

  it("should normalize CSV values by trimming whitespace", async () => {
    const csvContent = `firstName,lastName,email,preferredLanguage
  ${mockProfiles[0].firstName}  ,  ${mockProfiles[0].lastName}  ,${mockProfiles[0].email.toUpperCase()},  en  `;

    const filePath = path.join(tempDir, "normalize.csv");
    await fs.writeFile(filePath, csvContent);

    const result = await getProfilesFromCsv(filePath);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      firstName: mockProfiles[0].firstName,
      lastName: mockProfiles[0].lastName,
      email: mockProfiles[0].email.toUpperCase(),
      preferredLanguage: "en",
      address: undefined,
      city: undefined,
      dateOfBirth: undefined,
      phone: undefined,
      externalId: undefined,
    });
  });

  it("should handle empty optional fields", async () => {
    const csvContent = `firstName,lastName,email
${mockProfiles[0].firstName},${mockProfiles[0].lastName},${mockProfiles[0].email}`;

    const filePath = path.join(tempDir, "optional-fields.csv");
    await fs.writeFile(filePath, csvContent);

    const result = await getProfilesFromCsv(filePath);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      firstName: mockProfiles[0].firstName,
      lastName: mockProfiles[0].lastName,
      email: mockProfiles[0].email,
      phone: undefined,
      dateOfBirth: undefined,
      address: undefined,
      city: undefined,
      preferredLanguage: undefined,
      externalId: undefined,
    });
  });

  it("should throw error for missing required fields", async () => {
    const csvContent = `firstName,email
${mockProfiles[0].firstName},${mockProfiles[0].email}`;

    const filePath = path.join(tempDir, "missing-required.csv");
    await fs.writeFile(filePath, csvContent);

    await expect(getProfilesFromCsv(filePath)).rejects.toThrow(
      "Failed to parse CSV file",
    );
  });

  it("should throw error for invalid file path", async () => {
    // Create a subdirectory to ensure parent directory exists
    const testDir = path.join(tempDir, "test-invalid-path");
    await fs.mkdir(testDir, { recursive: true });

    const nonExistentPath = path.join(testDir, "non-existent.csv");
    await expect(getProfilesFromCsv(nonExistentPath)).rejects.toThrow(
      `Csv ${nonExistentPath} does not exist`,
    );
  });

  it("should throw error for empty CSV file", async () => {
    const filePath = path.join(tempDir, "empty.csv");
    await fs.writeFile(filePath, "");

    await expect(getProfilesFromCsv(filePath)).rejects.toThrow(
      "Failed to parse CSV file",
    );
  });

  it("should throw error for CSV with only headers", async () => {
    const csvContent =
      "firstName,lastName,email,phone,dateOfBirth,address,city,preferredLanguage";
    const filePath = path.join(tempDir, "headers-only.csv");
    await fs.writeFile(filePath, csvContent);

    await expect(getProfilesFromCsv(filePath)).rejects.toThrow(
      "Failed to parse CSV file",
    );
  });

  it("should handle CSV with BOM character", async () => {
    const csvContent = `\uFEFFfirstName,lastName,email
${mockProfiles[0].firstName},${mockProfiles[0].lastName},${mockProfiles[0].email}`;

    const filePath = path.join(tempDir, "bom.csv");
    await fs.writeFile(filePath, csvContent);

    const result = await getProfilesFromCsv(filePath);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      firstName: mockProfiles[0].firstName,
      lastName: mockProfiles[0].lastName,
      email: mockProfiles[0].email,
      phone: undefined,
      dateOfBirth: undefined,
      address: undefined,
      city: undefined,
      preferredLanguage: undefined,
      externalId: undefined,
    });
  });

  it("should handle CSV with quoted fields containing commas", async () => {
    const csvContent = `firstName,lastName,email,address
${mockProfiles[0].firstName},${mockProfiles[0].lastName},${mockProfiles[0].email},"123, Test Street"`;

    const filePath = path.join(tempDir, "quoted.csv");
    await fs.writeFile(filePath, csvContent);

    const result = await getProfilesFromCsv(filePath);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      firstName: mockProfiles[0].firstName,
      lastName: mockProfiles[0].lastName,
      email: mockProfiles[0].email,
      address: "123, Test Street",
      phone: undefined,
      dateOfBirth: undefined,
      city: undefined,
      preferredLanguage: undefined,
      externalId: undefined,
    });
  });
});
