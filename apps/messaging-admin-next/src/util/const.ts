const CUSTOM_HEADERS = {
  Pathname: "x-pathname",
  Search: "x-search",
}

const NEXT_LOCALE_COOKIE = "NEXT_LOCALE"

const LANG_EN = "en" as const
const LANG_GA = "ga" as const
const AVAILABLE_LOCALES = [LANG_EN, LANG_GA] as const
const DEFAULT_LOCALE = LANG_EN

const DUBLIN_TIMEZONE = "Europe/Dublin"

const MESSAGING_ADMIN_TOKEN_SERVICE_NAME = "messaging-admin" as const

export {
  AVAILABLE_LOCALES,
  CUSTOM_HEADERS,
  DEFAULT_LOCALE,
  DUBLIN_TIMEZONE,
  LANG_EN,
  LANG_GA,
  MESSAGING_ADMIN_TOKEN_SERVICE_NAME,
  NEXT_LOCALE_COOKIE,
}
