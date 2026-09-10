import { DEFAULT_LOCALE } from "@/const"

export function url(locale: string) {
  const _locale = locale || DEFAULT_LOCALE
  return {
    home: `/${_locale}`,
    externalOgcio: (base: string) => `${base}/${_locale}`,
    serviceUsers: {
      list: `/${_locale}/service-users`,
      one: (id: string) =>
        `/${_locale}/service-users/detail?id=${encodeURIComponent(id)}`,
      edit: (id: string) =>
        `/${_locale}/service-users/edit?id=${encodeURIComponent(id)}`,
      imports: (id: string) =>
        `/${_locale}/service-users/import?id=${encodeURIComponent(id)}`,
    },
    policy: {
      privacy: (base: string) => `${base}/${_locale}/privacy-policy`,
      cookie: (base: string) => `${base}/${_locale}/cookie-policy`,
      accessibilityStatement: (base: string) =>
        `${base}/${_locale}/accessibility-statement`,
      termsOfUse: (base: string) => `${base}/${_locale}/terms-of-use`,
    },
  }
}
