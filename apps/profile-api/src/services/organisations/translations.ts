import en from "./en.json" with { type: "json" };
import ga from "./ga.json" with { type: "json" };

export const translations = {
  en,
  ga,
};

export type Translations = typeof translations;

type OutputTranslations = {
  [lang in keyof Translations]: {
    name: string;
    shortName: string;
  };
};

export const getOrganisationTranslation = (
  organisationId: string,
): { id: string; translations: OutputTranslations } => {
  if (
    !Object.keys(translations.en).includes(organisationId) ||
    !Object.keys(translations.ga).includes(organisationId)
  ) {
    throw new Error(`Organisation ${organisationId} not found`);
  }

  const key = organisationId as keyof Translations[keyof Translations];
  const currentTranslation = {
    en: translations.en[key],
    ga: translations.ga[key],
  };

  return {
    id: organisationId,
    translations: {
      en: {
        name: currentTranslation.en.name,
        shortName: currentTranslation.en.shortName,
      },
      ga: {
        name: currentTranslation.ga.name,
        shortName: currentTranslation.ga.shortName,
      },
    },
  };
};
