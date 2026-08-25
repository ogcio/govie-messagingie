import { describe, expect, it } from "vitest";
import {
  getOrganisationTranslation,
  translations,
} from "~/services/organisations/translations.js";

// Get a valid organisationId from the en.json and ga.json mocks
const validOrgId = Object.keys(
  translations.en,
)[0] as keyof typeof translations.en;
const missingOrgId = "non-existent-org";

describe("getOrganisationTranslation", () => {
  it("returns translations for a valid organisationId", () => {
    const result = getOrganisationTranslation(validOrgId);
    expect(result).toEqual({
      id: validOrgId,
      translations: {
        en: {
          name: translations.en[validOrgId].name,
          shortName: translations.en[validOrgId].shortName,
        },
        ga: {
          name: translations.ga[validOrgId].name,
          shortName: translations.ga[validOrgId].shortName,
        },
      },
    });
  });

  it("throws an error if organisationId is missing in en or ga", () => {
    expect(() => getOrganisationTranslation(missingOrgId)).toThrow(
      `Organisation ${missingOrgId} not found`,
    );
  });
});
