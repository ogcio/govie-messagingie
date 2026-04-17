import { notFound } from "next/navigation"
import { hasLocale, NextIntlClientProvider } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { ClientShell } from "@/components/client-shell"
import { HtmlLangScript } from "@/components/html-lang-script"
import { ApplicationFooter } from "@/components/layout/application-footer"
import { routing } from "@/i18n/routing"
import favicon from "@/public/favicon.ico"
import "./styles.css"

/**
 * Locale Layout - Minimal Server Component
 *
 * This layout is intentionally minimal to reduce server-side CPU usage.
 * All interactive elements (navigation, buttons) are delegated to ClientShell.
 *
 * The outer <html>/<body> are provided by the root layout (app/layout.tsx).
 * This layout sets `document.documentElement.lang` via an inline script that
 * runs synchronously before first paint, so there is no flash of wrong locale.
 *
 * Server-side work:
 * - Locale validation (required for routing)
 * - Metadata generation (required for SEO)
 * - NextIntlClientProvider (required for i18n)
 *
 * Client-side work (in ClientShell):
 * - Navigation links
 * - Language switcher
 * - Back button
 * - All interactive UI
 *
 * Note: generateStaticParams() pre-generates locale routes at build time,
 * making subsequent requests much cheaper.
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

  // Validate locale - required for proper routing
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }
  setRequestLocale(locale)

  return (
    <NextIntlClientProvider>
      <HtmlLangScript locale={locale} />
      <ClientShell>{children}</ClientShell>
      <ApplicationFooter />
    </NextIntlClientProvider>
  )
}
