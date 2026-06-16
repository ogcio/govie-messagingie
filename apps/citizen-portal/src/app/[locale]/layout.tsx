import { notFound } from "next/navigation"
import { hasLocale, NextIntlClientProvider } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { HtmlLangScript } from "@/components/html-lang-script"
import { routing } from "@/i18n/routing"
import favicon from "@/public/favicon.ico"
import "./styles.css"

/**
 * Locale layout — server component, intentionally minimal.
 *
 * Phase B2 moved `ClientShell` and `ApplicationFooter` out of here so
 * that the `(public)/` and `(signout)/` route groups can opt out of
 * the auth gate. Each route group's own layout now wraps its children
 * in the appropriate shell:
 *
 *   - `(authenticated)/layout.tsx` → `ClientShell` (SAG + chrome + footer)
 *   - `(public)/layout.tsx`        → `PublicShell` (chrome + footer, no auth)
 *   - `(signout)/layout.tsx`       → `PublicShell` (chrome + footer, no auth)
 *
 * The outer <html>/<body> are provided by the root layout
 * (`app/layout.tsx`). The inline `HtmlLangScript` sets
 * `document.documentElement.lang` synchronously before first paint, so
 * there is no flash of wrong locale on the static export.
 */

export async function generateMetadata({ params }: LayoutProps<"/[locale]">) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "metadata" })

  return {
    title: t("title"),
    icons: [{ rel: "icon", url: favicon.src }],
  }
}

// Pre-generate all locale routes at build time
export { generateStaticParams } from "@/util/route-helpers"

export default async function Layout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params

  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }
  setRequestLocale(locale)

  return (
    <NextIntlClientProvider>
      <HtmlLangScript locale={locale} />
      {children}
    </NextIntlClientProvider>
  )
}
