import { LANG_GA } from "@/const"
import type { LocalizedText } from "@/types"

/**
 * Picks the localized string for the active locale, falling back to English
 * when the Irish variant is absent (the Journey-Builder API marks `ga` as
 * optional).
 */
export function pickLocalized(text: LocalizedText, locale: string): string {
  return locale === LANG_GA ? (text.ga ?? text.en) : text.en
}
