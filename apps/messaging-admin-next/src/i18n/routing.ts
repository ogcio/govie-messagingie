import { defineRouting } from "next-intl/routing"
import { AVAILABLE_LOCALES, DEFAULT_LOCALE } from "@/const"

export const routing = defineRouting({
  locales: AVAILABLE_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
})
