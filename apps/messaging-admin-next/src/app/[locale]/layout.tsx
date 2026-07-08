import { notFound } from "next/navigation"
import { hasLocale, NextIntlClientProvider } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import { HtmlLangScript } from "@/components/html-lang-script"
import { type Locale, messagesMap } from "@/i18n/locale"
import { routing } from "@/i18n/routing"
import favicon from "@/public/favicon.ico"
import "./styles.css"

export async function generateMetadata({ params }: LayoutProps<"/[locale]">) {
  const { locale } = await params

  return {
    title: locale === "ga" ? "MessagingIE Admin" : "MessagingIE Admin",
    icons: [{ rel: "icon", url: favicon.src }],
  }
}

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
    <NextIntlClientProvider
      locale={locale}
      messages={messagesMap[locale as Locale]}
    >
      <HtmlLangScript locale={locale} />
      {children}
    </NextIntlClientProvider>
  )
}
