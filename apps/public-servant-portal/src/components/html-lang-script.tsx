import type { AVAILABLE_LOCALES } from "@/const"
import { localeBootstrapScript } from "@/util/locale-cookie"

/**
 * Injects a synchronous script that sets document.documentElement.lang and
 * persists the locale to the shared NEXT_LOCALE cookie before first paint.
 * Must be used with suppressHydrationWarning on <html>.
 *
 * This is the same pattern used by next-themes for <html> attribute injection.
 */
export function HtmlLangScript({ locale }: { locale: string }) {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: localeBootstrapScript(
          locale as (typeof AVAILABLE_LOCALES)[number],
        ),
      }}
    />
  )
}
