import { AVAILABLE_LOCALES, DEFAULT_LOCALE } from "@/const"
import enMessages from "@/messages/en.json"
import gaMessages from "@/messages/ga.json"

export type Locale = (typeof AVAILABLE_LOCALES)[number]

export const messagesMap: Record<Locale, typeof enMessages> = {
  en: enMessages,
  ga: gaMessages as typeof enMessages,
}

export function detectLocale(): Locale {
  const segment = window.location.pathname.split("/")[1]
  return AVAILABLE_LOCALES.includes(segment as Locale)
    ? (segment as Locale)
    : DEFAULT_LOCALE
}
