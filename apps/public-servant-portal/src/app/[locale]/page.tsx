import { LocaleLandingRedirect } from "@/components/locale-landing-redirect"

export { generateStaticParams } from "@/util/route-helpers"

export default async function LocaleIndexPage(props: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await props.params
  return <LocaleLandingRedirect locale={locale} />
}
