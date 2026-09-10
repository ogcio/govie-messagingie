import { useTranslations } from "next-intl"
import { LANG_EN, LANG_GA } from "@/types/shared"
import { buildClientUrlWithSearchParams } from "./url-utils.client"

export function useClientLanguages({
  path,
  locale,
  search,
}: {
  path: string | null
  locale: string
  search: string | null
}) {
  const t = useTranslations("navigation.header")
  const isEnglish = locale === LANG_EN
  const oppositeLanguage = isEnglish ? LANG_GA : LANG_EN

  const languageToggleUrl = buildClientUrlWithSearchParams({
    dir: path
      ? `${path.replace(/(\/en\/|\/ga\/)/, `/${oppositeLanguage}/`)}`
      : "",
    searchParams: {
      search: search || "",
    },
  })

  const oppositeLanguageLabel = isEnglish ? t("link.irish") : t("link.english")

  return { href: languageToggleUrl.href, label: oppositeLanguageLabel }
}
