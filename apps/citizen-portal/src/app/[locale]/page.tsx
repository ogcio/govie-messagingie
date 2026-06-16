import { LocaleLandingRedirect } from "@/components/locale-landing-redirect"

export { generateStaticParams } from "@/util/route-helpers"

/**
 * Locale-root landing — server shell that defers the per-hostname
 * redirect to `LocaleLandingRedirect` (client). Kept as a server
 * component so it can co-export `generateStaticParams` for the static
 * export (`/en/`, `/ga/`).
 */
export default async function LocaleIndexPage({
  params,
}: PageProps<"/[locale]">) {
  const { locale } = await params
  return <LocaleLandingRedirect locale={locale} />
}
